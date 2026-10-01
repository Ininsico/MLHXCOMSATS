"""Local MedGemma engine for Aurora.

The model runs through the official llama.cpp `llama-server` binary (CUDA or
Vulkan build) that ships in `ai-service/llama-cpp/`. Everything stays on this
machine: the service only ever talks to `127.0.0.1`.

Startup tries a ladder of configurations so the pipeline keeps working when the
GPU cannot hold the whole model:

    1. all layers on the GPU + vision projector on the GPU
    2. all layers on the GPU + vision projector on the CPU  (frees ~850 MB VRAM)
    3. partial offload (a slice of the layers on the GPU)
    4. CPU only, with a warning

Whatever rung finally answers is reported by `/health` as `backend`/`nGpuLayers`.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

LOGGER = logging.getLogger("aurora.ai")

DISCLAIMER = (
    "For assistive use only — not a diagnostic tool. "
    "All outputs must be reviewed by a licensed clinician."
)

ANALYSIS_PROMPT = """You are MedGemma running locally inside Aurora, a hospital management system. You assist a licensed clinician by describing what is visible in a medical image.

Rules:
- Describe only what you can see. Never claim a definitive diagnosis.
- Be concise and clinical. No pleasantries, no markdown.
- If the image is not a medical scan, say so and keep severity low.

Answer with JSON only, exactly this shape:
{
  "findings": ["short observation", "short observation"],
  "impression": "normal" | "abnormal",
  "severity": "low" | "moderate" | "high",
  "confidence": 0.0-1.0,
  "recommended_followup": "one short sentence for the clinician"
}"""

PROMPT_FILE = "prompts/analysis_prompt.txt"

CHAT_PROMPT = """You are MedGemma running locally inside Aurora, a hospital management system. You support licensed clinicians with clinical reasoning. You are not a diagnostic tool: be precise, mention uncertainty, and never prescribe doses. Keep answers short and structured."""


@dataclass
class Attempt:
    n_gpu_layers: int
    mmproj_offload: bool
    label: str


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def build_ladder() -> list[Attempt]:
    """Configurations to try, best-value first.

    On a 4 GB card the *full* offload cannot fit (2.4 GB weights + 851 MB vision
    projector + context), and attempting it costs a minute of GPU load before the
    driver gives up with `ErrorDeviceLost`. So the default order starts with the
    configuration that demonstrably works here — LLM on the GPU, vision projector
    on the CPU — and only tries the heavier one when explicitly asked for.
    """
    configured = int(os.getenv("MEDGEMMA_N_GPU_LAYERS", "-1"))
    attempts: list[Attempt] = []

    if configured > 0:
        attempts.append(Attempt(configured, False, f"gpu-partial-{configured}"))
    else:
        # Known good on 4 GB: every transformer layer on the GPU, projector on CPU.
        attempts.append(Attempt(-1, False, "gpu-llm-vision-on-cpu"))
        attempts.append(Attempt(24, False, "gpu-partial-24"))
        attempts.append(Attempt(12, False, "gpu-partial-12"))

        if _env_flag("MEDGEMMA_TRY_FULL_OFFLOAD", False):
            attempts.append(Attempt(-1, True, "gpu-full"))

    attempts.append(Attempt(0, False, "cpu"))

    seen: set[tuple[int, bool]] = set()
    unique: list[Attempt] = []

    for attempt in attempts:
        key = (attempt.n_gpu_layers, attempt.mmproj_offload)
        if key in seen:
            continue
        seen.add(key)
        unique.append(attempt)

    return unique


class MedGemmaEngine:
    """Supervises one llama-server process and proxies inference to it."""

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.model_path = (base_dir / os.getenv("MEDGEMMA_MODEL_PATH", "models/medgemma-1.5-4b-it-Q4_K_M.gguf")).resolve()
        self.mmproj_path = (base_dir / os.getenv("MEDGEMMA_MMPROJ_PATH", "models/mmproj-F16.gguf")).resolve()
        self.server_dir = (base_dir / os.getenv("LLAMA_SERVER_DIR", "llama-cpp/vulkan")).resolve()
        self.port = int(os.getenv("LLAMA_SERVER_PORT", "8080"))
        self.n_ctx = int(os.getenv("MEDGEMMA_N_CTX", "2048"))
        self.timeout = float(os.getenv("MEDGEMMA_TIMEOUT_SECONDS", "180"))
        self.default_max_tokens = int(os.getenv("MEDGEMMA_MAX_TOKENS", "512"))
        self.default_temperature = float(os.getenv("MEDGEMMA_TEMPERATURE", "0.2"))

        self.process: Optional[subprocess.Popen] = None
        self.active: Optional[Attempt] = None
        self.model_version = self.model_path.stem or "unknown"
        self.mmproj_offloaded = False
        self.missing: Optional[str] = None
        self.system_prompt = self._load_prompt()
        self._device_args: Optional[list[str]] = None
        self.ready_timeout = float(os.getenv("MEDGEMMA_READY_TIMEOUT", "150"))

    # ------------------------------------------------------- last known good

    @property
    def state_file(self) -> Path:
        return self.base_dir / "data" / "last_good.json"

    def _read_last_good(self) -> Optional[tuple[int, bool]]:
        try:
            data = json.loads(self.state_file.read_text(encoding="utf-8"))
            return (int(data["nGpuLayers"]), bool(data["mmprojOffload"]))
        except Exception:  # noqa: BLE001
            return None

    def _write_last_good(self, attempt: Attempt) -> None:
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            self.state_file.write_text(
                json.dumps(
                    {
                        "nGpuLayers": attempt.n_gpu_layers,
                        "mmprojOffload": attempt.mmproj_offload,
                        "label": attempt.label,
                        "device": " ".join(self.device_args()[1:]) or "default",
                        "savedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        except Exception as exc:  # noqa: BLE001
            LOGGER.warning("Could not persist the last good configuration (%s)", exc)

    def _load_prompt(self) -> str:
        """Prefer the calibrated prompt written by training/tune_prompt.py."""
        prompt_path = self.base_dir / PROMPT_FILE

        if prompt_path.exists():
            text = prompt_path.read_text(encoding="utf-8").strip()
            if text:
                LOGGER.info("Using calibrated prompt from %s", prompt_path)
                return text

        return ANALYSIS_PROMPT

    def device_args(self) -> list[str]:
        """Pin the discrete GPU.

        llama.cpp uses the first backend device by default — on this laptop that is
        the Intel UHD 630, which is far slower than the GTX 1050 Ti. Ask llama.cpp
        for its device list and select the NVIDIA entry explicitly.
        """
        if self._device_args is not None:
            return self._device_args

        self._device_args = []

        try:
            completed = subprocess.run(
                [str(self.server_exe), "--list-devices"],
                cwd=str(self.server_dir),
                capture_output=True,
                text=True,
                timeout=60,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            output = f"{completed.stdout or ''}\n{completed.stderr or ''}"
        except Exception as exc:  # noqa: BLE001
            LOGGER.warning("Could not list GPU devices (%s) — using the default", exc)
            return self._device_args

        for line in output.splitlines():
            if not any(marker in line for marker in ("NVIDIA", "GeForce", "GTX", "RTX", "Quadro")):
                continue

            match = re.match(r"\s*((?:Vulkan|CUDA|Metal)\d*)", line)
            if match and match.group(1):
                self._device_args = ["--device", match.group(1)]
                LOGGER.info("Selected GPU device: %s", line.strip())
                return self._device_args

        LOGGER.warning("No discrete GPU found in the device list — falling back to the default")
        return self._device_args

    # ---------------------------------------------------------------- paths

    @property
    def server_exe(self) -> Path:
        return self.server_dir / "llama-server.exe"

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    @property
    def loaded(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def describe(self) -> dict[str, Any]:
        return {
            "modelLoaded": self.loaded,
            "modelVersion": self.model_version,
            "backend": self.active.label if self.active else "not-started",
            "device": "GTX 1050 Ti (Vulkan)" if self.active and self.active.n_gpu_layers != 0 else "cpu",
            "nGpuLayers": self.active.n_gpu_layers if self.active else 0,
            "mmprojOffloaded": self.mmproj_offloaded,
            "serverUrl": self.base_url,
        }

    # ------------------------------------------------------------- lifecycle

    def start(self) -> None:
        if not self.server_exe.exists():
            self.missing = f"llama-server.exe not found in {self.server_dir}"
            LOGGER.error(self.missing)
            return
        if not self.model_path.exists():
            self.missing = f"model file not found: {self.model_path}"
            LOGGER.warning("%s — the service will report modelLoaded=false", self.missing)
            return
        if not self.mmproj_path.exists():
            self.missing = f"vision projector not found: {self.mmproj_path}"
            LOGGER.warning("%s — image analysis will be unavailable", self.missing)

        for attempt in self._ordered_attempts():
            if self._launch(attempt):
                return
            LOGGER.warning("Configuration %s failed — trying the next one", attempt.label)

        LOGGER.error("MedGemma could not be started with any configuration")

    def _ordered_attempts(self) -> list[Attempt]:
        """Ladder order, with the configuration that worked last time first."""
        attempts = build_ladder()
        last_good = self._read_last_good()

        if not last_good:
            return attempts

        attempts.sort(key=lambda item: 0 if (item.n_gpu_layers, item.mmproj_offload) == last_good else 1)

        if attempts:
            LOGGER.info("Starting from the last known good configuration: %s", attempts[0].label)

        return attempts

    def _launch(self, attempt: Attempt) -> bool:
        args = [
            str(self.server_exe),
            "-m",
            str(self.model_path),
            "-ngl",
            str(attempt.n_gpu_layers),
            "-c",
            str(self.n_ctx),
            "--host",
            "127.0.0.1",
            "--port",
            str(self.port),
            "--no-warmup",
            *self.device_args(),
        ]

        if self.mmproj_path.exists():
            args += ["--mmproj", str(self.mmproj_path)]
            if not attempt.mmproj_offload:
                args.append("--no-mmproj-offload")

        if attempt.n_gpu_layers == 0:
            LOGGER.warning("Running MedGemma on CPU (slow) — the GPU could not take the model")

        LOGGER.info(
            "Starting llama-server (%s): n_gpu_layers=%s mmproj_offload=%s device=%s",
            attempt.label,
            attempt.n_gpu_layers,
            attempt.mmproj_offload,
            " ".join(self.device_args()[1:]) or "default",
        )

        creation = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        self.process = subprocess.Popen(
            args,
            cwd=str(self.server_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=creation,
        )

        if self._wait_until_ready():
            self.active = attempt
            self.mmproj_offloaded = attempt.mmproj_offload
            self._write_last_good(attempt)
            LOGGER.info("MedGemma ready via %s", attempt.label)
            return True

        self._stop_process()
        # Give the driver a moment to release the VRAM before the next rung.
        time.sleep(4)
        return False

    def _wait_until_ready(self, timeout: Optional[float] = None) -> bool:
        assert self.process is not None
        deadline = time.time() + (timeout or self.ready_timeout)

        while time.time() < deadline:
            if self.process.poll() is not None:
                tail = self._drain_output()
                LOGGER.warning("llama-server exited early (%s): %s", self.process.returncode, tail[-600:])
                return False
            try:
                response = httpx.get(f"{self.base_url}/health", timeout=2.0)
                if response.status_code == 200 and response.json().get("status") == "ok":
                    return True
            except Exception:  # noqa: BLE001 — still booting
                pass
            time.sleep(0.5)

        LOGGER.warning("llama-server did not report healthy within %.0fs", timeout or self.ready_timeout)
        return False

    def _drain_output(self) -> str:
        if not self.process or not self.process.stdout:
            return ""
        try:
            return self.process.stdout.read() or ""
        except Exception:  # noqa: BLE001
            return ""

    def _stop_process(self) -> None:
        if not self.process:
            return
        try:
            self.process.terminate()
            self.process.wait(timeout=20)
        except Exception:  # noqa: BLE001
            try:
                self.process.kill()
            except Exception:  # noqa: BLE001
                pass
        finally:
            self.process = None

    def stop(self) -> None:
        self._stop_process()
        self.active = None

    # ------------------------------------------------------------- inference

    def _post_chat(self, messages: list[dict[str, Any]], max_tokens: int, temperature: float) -> str:
        payload = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("llama-server returned no choices")
        return (choices[0].get("message") or {}).get("content", "").strip()

    def chat(self, messages: list[dict[str, str]], max_tokens: Optional[int], temperature: Optional[float]) -> tuple[str, int]:
        started = time.perf_counter()
        reply = self._post_chat(
            [{"role": m["role"], "content": m["content"]} for m in messages],
            max_tokens or self.default_max_tokens,
            self.default_temperature if temperature is None else temperature,
        )
        return reply, int((time.perf_counter() - started) * 1000)

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        question: Optional[str],
        max_tokens: Optional[int],
        temperature: Optional[float],
        system_prompt: Optional[str] = None,
        impression: bool = True,
    ) -> tuple[dict[str, Any], int, str]:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        prompt = question.strip() if question and question.strip() else "Describe the findings in this scan."

        messages = [
            {"role": "system", "content": (system_prompt or self.system_prompt).strip()},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}},
                ],
            },
        ]

        started = time.perf_counter()
        raw = self._post_chat(messages, max_tokens or self.default_max_tokens,
                              self.default_temperature if temperature is None else temperature)
        latency = int((time.perf_counter() - started) * 1000)

        return parse_analysis(raw), latency, raw


# --------------------------------------------------------------- JSON shaping

def _extract_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    return {}


def parse_analysis(raw: str) -> dict[str, Any]:
    data = _extract_json(raw)

    findings = data.get("findings")
    if isinstance(findings, str):
        findings = [findings]
    findings = [str(item).strip() for item in findings] if isinstance(findings, list) else []
    findings = [item for item in findings if item][:6]
    if not findings:
        findings = [raw.strip()[:400] or "The model returned no readable findings."]

    severity = str(data.get("severity", "")).strip().lower()
    if severity not in {"low", "moderate", "high"}:
        severity = "moderate"

    impression = str(data.get("impression", "")).strip().lower()
    if impression not in {"normal", "abnormal"}:
        # Derive it when the model omits the field: anything with raised urgency or
        # explicit pathological wording counts as abnormal.
        text = " ".join(findings).lower()
        pathology = ("consolidation", "opacity", "infiltrate", "effusion", "nodule", "pneumonia", "fracture", "mass", "edema")
        impression = "abnormal" if severity != "low" or any(word in text for word in pathology) else "normal"

    try:
        confidence = float(data.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    followup = str(data.get("recommended_followup", "")).strip() or "Review the image alongside the patient's history."

    return {
        "findings": findings,
        "impression": impression,
        "severity": severity,
        "confidence": confidence,
        "recommended_followup": followup[:400],
        "disclaimer": DISCLAIMER,
    }


# ------------------------------------------------------------ DICOM helpers

def is_dicom(data: bytes, filename: str = "") -> bool:
    if data[:4] == b"DICM":
        return True
    return filename.lower().endswith((".dcm", ".dicom"))


def dicom_to_png(data: bytes) -> bytes:
    """Convert a DICOM instance to an 8-bit PNG for the vision encoder."""
    import numpy as np
    from PIL import Image
    from pydicom import dcmread

    dataset = dcmread(io.BytesIO(data), force=True)
    pixels = dataset.pixel_array.astype("float32")

    low, high = np.percentile(pixels, [1, 99])
    if not np.isfinite(low) or not np.isfinite(high) or high <= low:
        low, high = float(pixels.min()), float(pixels.max()) or 1.0

    scaled = np.clip((pixels - low) / (high - low), 0.0, 1.0) * 255.0

    if getattr(dataset, "PhotometricInterpretation", "") == "MONOCHROME1":
        scaled = 255.0 - scaled

    image = Image.fromarray(scaled.astype("uint8"))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
