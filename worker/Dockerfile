# Fries profile worker: AWS Lambda container image (x86_64), CPU only.
#   docker build --platform linux/amd64 -t fries-worker worker/
# Models are downloaded at build time and baked into the image, so the function never calls out
# to any model hub or AI API at runtime.

ARG PYTHON=3.12

# ---- 1. compile llama-cpp-python (prebuilt wheels are too old for Qwen3/Qwen3.5) ----------------
FROM public.ecr.aws/lambda/python:${PYTHON} AS llama-build
ARG LLAMA_CPP_PYTHON=0.3.36
RUN dnf install -y gcc gcc-c++ cmake make git && dnf clean all
# Portable build: no -march=native (the build machine's CPU), but AVX2/FMA which Lambda x86 supports.
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_BLAS=OFF -DLLAMA_CURL=OFF" \
    FORCE_CMAKE=1
RUN pip wheel --no-deps --wheel-dir /wheels "llama-cpp-python==${LLAMA_CPP_PYTHON}"

# ---- 2. fetch models -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/python:${PYTHON} AS models
# Whisper: Systran/faster-whisper-{tiny,base,small}[.en]. small = best accuracy that stays fast on CPU.
ARG WHISPER_REPO=Systran/faster-whisper-small
# LLM: any llama.cpp GGUF. Fallback if Qwen3.5 misbehaves: unsloth/Qwen3-1.7B-GGUF + Qwen3-1.7B-Q4_K_M.gguf
ARG LLM_REPO=unsloth/Qwen3.5-2B-GGUF
ARG LLM_FILE=Qwen3.5-2B-Q4_K_M.gguf
RUN pip install --no-cache-dir "huggingface_hub>=0.25"
RUN python -c "from huggingface_hub import snapshot_download, hf_hub_download; import shutil; \
snapshot_download('${WHISPER_REPO}', local_dir='/opt/models/whisper', allow_patterns=['config.json','model.bin','tokenizer.json','vocabulary.*','preprocessor_config.json']); \
shutil.copy(hf_hub_download('${LLM_REPO}', '${LLM_FILE}'), '/opt/models/llm.gguf')"

# ---- 3. runtime ----------------------------------------------------------------------------------
FROM public.ecr.aws/lambda/python:${PYTHON}
# libgomp: OpenMP runtime used by llama.cpp
RUN dnf install -y libgomp && dnf clean all
COPY requirements.txt .
COPY --from=llama-build /wheels /wheels
RUN pip install --no-cache-dir -r requirements.txt /wheels/*.whl && rm -rf /wheels
COPY --from=models /opt/models /opt/models
COPY app/ ${LAMBDA_TASK_ROOT}/
ENV MODEL_DIR=/opt/models HF_HUB_OFFLINE=1
CMD ["handler.handler"]
