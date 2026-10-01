# Aurora local AI sidecar

MedGemma 1.5 4B running **on this machine** for Aurora's clinical AI assistant. No
network calls, no cloud API: patient scans and questions never leave the host.

```
Aurora frontend ──► Express API ──► this sidecar (FastAPI) ──► llama-server (llama.cpp)
/browser            /api/ai/*        /analyze-image            GGUF + mmproj on the GPU
                     (auth, logs,    /chat                     (Vulkan, 1050 Ti)
                      cache, RBAC)
```

The frontend never talks to this service directly — Express owns sessions, role checks,
the inference log, the image-hash cache and the admin settings, then proxies here.

## Why the engine is `llama-server` and not `llama-cpp-python`

The original spec asked for `llama-cpp-python` with `create_chat_completion`. That
package has **no Windows wheels** (PyPI only publishes source tarballs) and building it
needs MSVC Build Tools + the CUDA Toolkit — neither is installed here, and the build
fails at `nmake`. The official llama.cpp **release binaries** are the same engine
(`llama-server.exe`, build b11146 / v0.5.0-dev) with zero compiler dependency, so this
service supervises one `llama-server` process and speaks to its OpenAI-compatible
endpoint. The HTTP contract below (`/analyze-image`, `/chat`, structured JSON) is exactly
what the spec asked for.

## Hardware reality (measured on this machine)

| Item | Value |
| --- | --- |
| GPU | NVIDIA GTX 1050 Ti Max-Q, 4096 MiB (≈3609 MiB free), driver 572.70, cc 6.1 |
| Backend | llama.cpp **Vulkan** build (CUDA 13 nightly needs a newer driver) |
| Startup ladder | rung 1 `gpu-full` too big → **rung 2 `gpu-llm-vision-on-cpu`** wins |
| Meaning | all 4B LLM layers on the GPU · the 811 MB vision projector stays on the CPU |
| Load time | ~25 s from process start to `/health: ok` |

The ladder (`app/model.py`) is what keeps this working on small GPUs:

1. `gpu-full` — LLM + projector on the GPU (needs ~3.4 GB free)
2. `gpu-llm-vision-on-cpu` — LLM on the GPU, projector on the CPU (**what we run**)
3. `gpu-partial-24` / `gpu-partial-12` — a slice of the layers on the GPU
4. `cpu` — everything on the CPU, logged with a warning

Whatever rung answered is reported by `/health`. Set `MEDGEMMA_N_GPU_LAYERS=0` in `.env`
to force CPU, `MEDGEMMA_N_CTX` to shrink the context, or `MEDGEMMA_NO_MMPROJ_OFFLOAD=false`
to try the projector on the GPU again.

## Install

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt

# llama.cpp binaries (compiler-free). Vulkan works on Pascal; swap for the CUDA 12.4
# zip on newer GPUs and set LLAMA_SERVER_DIR=llama-cpp/cuda in .env.
curl -L -o llama-cpp/llama-vulkan.zip \
  https://github.com/ggml-org/llama.cpp/releases/download/b11146/llama-b11146-bin-win-vulkan-x64.zip
powershell -Command "Expand-Archive llama-cpp/llama-vulkan.zip -DestinationPath llama-cpp/vulkan -Force"

# MedGemma weights + the vision projector (≈3.2 GB, one time)
hf download unsloth/medgemma-1.5-4b-it-GGUF \
  medgemma-1.5-4b-it-Q4_K_M.gguf mmproj-F16.gguf --local-dir models

copy .env.example .env
```

## Run

```bash
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`GET /health` should report `modelLoaded: true` with the backend rung it landed on.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | status, backend rung, GPU layers, model version |
| `POST /analyze-image` | multipart `file` (+ optional `question`, `system_prompt`, `max_tokens`, `temperature`) → `{findings, impression, severity, confidence, recommended_followup, disclaimer, latency_ms}` |
| `POST /chat` | text-only clinical reasoning |

`system_prompt` exists for the calibration scripts; leaving it out uses the active prompt
in `prompts/analysis_prompt.txt`.

## Dataset, evaluation and calibration

The harness runs the model against **PneumoniaMNIST** (MedMNIST v2) — public,
de-identified chest radiographs, CC BY 4.0. Nothing patient-identifiable is downloaded.

```bash
# 1. fetch + process a balanced slice (contrast normalised, 512x512 PNG, manifest.json)
.venv\Scripts\python scripts\prepare_dataset.py --per-class 8

# 2. score the live service on the held-out test split
.venv\Scripts\python scripts\evaluate.py --split test

# 3. calibrate the prompt on the validation slice; the winner becomes the live prompt
.venv\Scripts\python scripts\tune_prompt.py --per-class 4
```

Reports land in `docs/eval-*.json` and `docs/tuning-report.json`.

### Results

_(filled in by the runs in this repository — see `docs/`)_
