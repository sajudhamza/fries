# Fries profile worker

Turns an intro video into profile fields with open-source models only. No third-party AI API is called at
any point; models are baked into the image at build time.

| Step | What | Open-source project |
| --- | --- | --- |
| Speech-to-text | `Systran/faster-whisper-small`, int8 on CPU, voice-activity filter | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) (MIT) |
| Age, height, pronouns, name | Deterministic rules in `app/rules.py` (fire only on explicit statements) | |
| Job, hobbies, bio, looking for | `Qwen3.5-2B` Q4_K_M GGUF, JSON-schema-constrained output | [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) via [abetlen/llama-cpp-python](https://github.com/abetlen/llama-cpp-python) (MIT); model [unsloth/Qwen3.5-2B-GGUF](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF) (Apache-2.0) |
| Fact check | Drops any LLM output whose words the person didn't actually say | `app/rules.py` |

Flow: the app invokes the Lambda asynchronously with a signed video URL, a callback URL and a per-job
token. The worker downloads, transcribes, extracts, and POSTs the result to `/api/worker/result`. The guest's
phone polls until the profile moves to review (or falls back to the manual form after 8 minutes).

## Deploy to AWS Lambda

```bash
./worker/deploy.sh
```

Creates the ECR repo, execution role and a 10 GB / 6 vCPU, 600 s function (falls back to 3008 MB on new
accounts with the default quota), then prints the env vars and IAM policy to add in Amplify. Re-run it to
ship changes. Cost is roughly 1 to 2 cents per video; nothing when idle.

Swap models with build args, e.g. a faster but less accurate transcriber, or the Qwen3 fallback:

```bash
docker build --platform linux/amd64 --build-arg WHISPER_REPO=Systran/faster-whisper-base \
  --build-arg LLM_REPO=unsloth/Qwen3-1.7B-GGUF --build-arg LLM_FILE=Qwen3-1.7B-Q4_K_M.gguf -t fries-worker worker/
```

## Run locally

```bash
docker build --platform linux/amd64 -t fries-worker worker/
docker run --rm -p 9000:8080 fries-worker
```

Then in the app's `.env.local`:

```
WORKER_URL=http://localhost:9000/2015-03-31/functions/function/invocations
WORKER_APP_URL=http://host.docker.internal:3100
```

Rule tests (no Docker needed): `python3 worker/tests/test_rules.py`
