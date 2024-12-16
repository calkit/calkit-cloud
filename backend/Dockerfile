FROM python:3.12

WORKDIR /app/

# Install uv
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#installing-uv
COPY --from=ghcr.io/astral-sh/uv:0.4.15 /uv /bin/uv

# Place executables in the environment at the front of the path
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#using-the-environment
ENV PATH="/app/.venv/bin:$PATH"

# Compile bytecode
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#compiling-bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#caching
ENV UV_LINK_MODE=copy

# Install dependencies
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project

# Add Google credentials if specified
ARG GOOGLE_CREDENTIALS
RUN bash -c "if [ '$GOOGLE_CREDENTIALS' ] ; then mkdir -p /root/.config/gcloud && echo '$GOOGLE_CREDENTIALS' > /root/.config/gcloud/application_default_credentials.json ; fi"

ENV PYTHONPATH=/app

ENV PYTHONUNBUFFERED=1

COPY ./scripts /app/scripts

COPY ./alembic.ini /app/

COPY ./prestart.sh /app/

COPY ./tests-start.sh /app/

COPY ./pyproject.toml ./uv.lock /app/

COPY ./app /app/app

COPY ./calkit /app/calkit

# Sync the project
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

RUN uv pip install -e /app/calkit

CMD ["fastapi", "run", "--workers", "4", "app/main.py"]
