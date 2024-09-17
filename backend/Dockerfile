FROM tiangolo/uvicorn-gunicorn-fastapi:python3.11

WORKDIR /app/

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

# Copy poetry.lock* in case it doesn't exist in the repo
COPY ./pyproject.toml ./poetry.lock* /app/

# Allow installing dev dependencies to run tests
ARG INSTALL_DEV=false
RUN bash -c "if [ $INSTALL_DEV == 'true' ] ; then poetry install --no-root ; else poetry install --no-root --only main ; fi"

# Add Google credentials if specified
ARG GOOGLE_CREDENTIALS
RUN bash -c "if [ $GOOGLE_CREDENTIALS ] ; then mkdir -p /root/.config/gcloud && echo $GOOGLE_CREDENTIALS > /root/.config/gcloud/application_default_credentials.json ; fi"

ENV PYTHONPATH=/app

ENV PYTHONUNBUFFERED=1

COPY ./scripts /app/scripts

COPY ./alembic.ini /app/

COPY ./prestart.sh /app/

COPY ./tests-start.sh /app/

COPY ./app /app/app
