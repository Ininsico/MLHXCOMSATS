# Aurora AI stack — status

_Measured on this machine (GTX 1050 Ti Max-Q 4 GB, driver 572.70, Windows, Python 3.12)._

## Working, verified live

| Piece | Evidence |
| --- | --- |
| **Model service** (FastAPI, offline) | `/health` → `modelLoaded: true`, `gpu-partial-24`, `medgemma-1.5-4b-it-Q4_K_M` |
| **GPU utilisation** | Device explicitly pinned to `Vulkan1: NVIDIA GeForce GTX 1050 Ti` (the default was the Intel UHD 630 — that was the real cause of the slow runs) |
| **Startup speed** | `data/last_good.json` remembers the winning configuration; the ladder now opens with it, so a restart is a single successful attempt |
| **Text chat** | `/chat` → correct clinical answer in **9.3 s** |
| **Image analysis** | Real chest radiograph → impression `NORMAL`, severity `low`, confidence **0.95**, findings *"lungs appear clear with no obvious consolidation, pleural effusion, or pneumothorax"* |
| **RAG (Chroma)** | 21 chunks / 3 sources; question about HbA1c → grounded answer **with 4 citations in 9.8 s**; hybrid ranking (vector + keywords + source spread) |
| **RabbitMQ** | `rabbitmq:3-management` in Docker on 5672/15672; every analysis publishes an `analysis.completed` job; `scripts/worker.py` consumes and logs it (`data/jobs.log.jsonl`) |
| **Training/calibration codebase** | `training/prepare_dataset.py` (Pulled PneumoniaMNIST: **48 labelled public CXR images**), `training/evaluate.py` (accuracy/sensitivity/specificity/JSON validity/latency), `training/tune_prompt.py` (scores candidate prompts on real labels, writes the winner to `prompts/analysis_prompt.txt`) |
| **Server structure** | `app/main.py` assembles; `app/routers/{health,analysis,chat,rag,jobs}.py`; `app/rag/{chunking,store,ingest,retrieve,pipeline}.py`; `app/{engine,model,queue,schemas}.py` |

## Known limits (hardware, not bugs)

- **Full GPU offload is impossible here.** 2.4 GB weights + 851 MB vision projector +
  context does not fit in the 1050 Ti's 3.6 GB of free VRAM; the driver aborts with
  `vk::Queue::submit: ErrorDeviceLost`. `gpu-partial-24` (24 of ~34 layers on the GPU)
  is the ceiling for this card.
- **Image analysis takes ~56 s** because the vision projector encodes on the CPU. The
  text path is fast (9 s); the projector is the fixed cost. On a GPU with ~6 GB free,
  set `MEDGEMMA_TRY_FULL_OFFLOAD=true` and it drops into the ~10-15 s range the spec
  targets.
- **Fine-tuning (gradient updates) is not possible on this GPU.** A QLoRA run on a 4B
  vision model needs roughly 16 GB+ of VRAM. What the repo does instead — and what
  `training/` implements — is *calibration*: labelled public data, measured agreement,
  and the best-scoring prompt loaded by the service. The LoRA path (Unsloth on a rented
  GPU → re-quantise to GGUF → drop into `models/`) is documented in `README.md`.

## Next (in order)

1. **Finish the app wiring for RAG**: `POST /api/ai/ask` + `GET /api/ai/knowledge` in
   Express (RBAC: doctor/radiologist/admin) and a "Knowledge" panel on `/doctor/ai`.
2. Run `training/tune_prompt.py` on the validation slice and `training/evaluate.py` on
   the held-out test slice; paste the numbers into `README.md` and `docs/`.
3. Drain the queue in the demo script (`scripts/worker.py --once`) and show
   `GET /jobs` in the UI.
4. Re-run `npm run lint` + `npm run build` for the frontend changes.

## Commands

```bash
# sidecar (already running on :8000)
cd ai-service && .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# stack check / demo / index / worker
.venv\Scripts\python scripts\smoke_check.py
.venv\Scripts\python scripts\demo_analysis.py
.venv\Scripts\python scripts\build_index.py
.venv\Scripts\python scripts\worker.py --once

# calibration
.venv\Scripts\python training\prepare_dataset.py --per-class 8 --size 384
.venv\Scripts\python training\tune_prompt.py --per-class 4
.venv\Scripts\python training\evaluate.py --split test
```
