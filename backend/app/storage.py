"""Functionality for managing object storage."""

import json
import os
from typing import Literal

import gcsfs
import s3fs
from app.config import settings
from google.cloud import storage as gcs
from google.oauth2 import service_account as gcs_service_account

# Multipart/chunked upload configuration
MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024  # 64 MB
MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024  # 16 MB
CHUNKED_CHUNK_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB


def get_backend() -> Literal["s3", "gcs"]:
    """Get the configured storage backend for the current environment."""
    return "s3" if settings.ENVIRONMENT == "local" else "gcs"


def upload_should_be_chunked(content_length: int | None) -> bool:
    """Determine if an upload should use multipart/chunked strategy."""
    return (
        content_length is not None
        and content_length >= MULTIPART_THRESHOLD_BYTES
    )


def get_upload_chunk_size() -> int:
    """Get the chunk/part size for the backend in bytes."""
    return (
        MULTIPART_PART_SIZE_BYTES
        if get_backend() == "s3"
        else CHUNKED_CHUNK_SIZE_BYTES
    )


def get_gcs_credentials() -> dict | None:
    """Get GCS credentials from environment."""
    creds_json = os.getenv("GOOGLE_CREDENTIALS")
    if creds_json:
        return json.loads(creds_json)
    return None


def get_gcs_client() -> gcs.Client:
    """Get a Google Cloud Storage client with credentials from environment."""
    creds_dict = get_gcs_credentials()
    if creds_dict:
        credentials = (
            gcs_service_account.Credentials.from_service_account_info(
                creds_dict
            )
        )
        return gcs.Client(credentials=credentials)
    return gcs.Client()


def remove_gcs_content_type(fpath):
    client = get_gcs_client()
    bucket = client.bucket(f"calkit-{settings.ENVIRONMENT}")
    blob = bucket.blob(fpath.removeprefix(f"gcs://{bucket.name}/"))
    blob.content_type = None
    blob.patch()


def get_object_fs() -> s3fs.S3FileSystem | gcsfs.GCSFileSystem:
    if settings.ENVIRONMENT == "local":
        return s3fs.S3FileSystem(
            endpoint_url="http://minio:9000",
            key="root",
            secret=os.getenv("MINIO_ROOT_PASSWORD"),
        )
    return gcsfs.GCSFileSystem(token=get_gcs_credentials())


def get_data_prefix() -> str:
    if settings.ENVIRONMENT == "local":
        return "s3://data"
    else:
        return f"gcs://calkit-{settings.ENVIRONMENT}/data"


def get_data_prefix_for_owner(owner_name: str) -> str:
    return f"{get_data_prefix()}/{owner_name}"


def make_data_fpath(
    owner_name: str, project_name: str, idx: str, md5: str
) -> str:
    prefix = get_data_prefix_for_owner(owner_name)
    return f"{prefix}/{project_name}/{idx}/{md5}"


def _replace_local_object_host(url: str) -> str:
    if settings.ENVIRONMENT == "local":
        return url.replace(
            "http://minio:9000", f"http://objects.{settings.DOMAIN}"
        )
    return url


def get_object_url(
    fpath: str,
    fname: str | None = None,
    expires: int = 3600 * 24,
    fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem | None = None,
    method: Literal["get", "put"] = "get",
    *,
    content_type: str | None = None,
    chunked: bool = False,
    **kwargs,
) -> str:
    """Get a presigned URL for an object in object storage."""
    if chunked and method != "put":
        raise ValueError("Chunked upload is only supported for PUT method")
    if fs is None:
        fs = get_object_fs()
    # If chunked upload is requested, generate the appropriate init URL
    if chunked and method == "put":
        if settings.ENVIRONMENT == "local":
            init_kwargs = {}
            if content_type:
                init_kwargs["ContentType"] = content_type
            init_url = fs.sign(
                fpath,
                expiration=expires,
                client_method="create_multipart_upload",
                **(init_kwargs | kwargs),
            )
            if init_url is None:
                raise RuntimeError("Failed to generate multipart init URL")
            return _replace_local_object_host(init_url)
        # GCS resumable upload
        try:
            init_url = fs.sign(
                fpath,
                expiration=expires,
                method="POST",
                **kwargs,
            )
        except Exception:
            init_url = None
        if init_url is None:
            init_url = fs.sign(
                fpath,
                expiration=expires,
                method="PUT",
                **kwargs,
            )
        if init_url is None:
            raise RuntimeError("Failed to generate chunked init URL")
        return init_url
    # Standard presigned URL
    if settings.ENVIRONMENT == "local":
        kws = {}
        if fname is not None:
            kws["ResponseContentDisposition"] = f"filename={fname}"
            if fname.endswith(".pdf"):
                kws["ResponseContentType"] = "application/pdf"
            elif fname.endswith(".html"):
                kws["ResponseContentType"] = "text/html"
        kws["client_method"] = f"{method}_object"
    else:
        kws = {}
        if fname is not None:
            kws["response_disposition"] = f"filename={fname}"
            if fname.endswith(".pdf"):
                kws["response_type"] = "application/pdf"
            elif fname.endswith(".html"):
                kws["response_type"] = "text/html"
        kws["method"] = method.upper()
    signed_url = fs.sign(fpath, expiration=expires, **(kws | kwargs))
    if signed_url is None:
        raise RuntimeError("Failed to generate presigned URL")
    return _replace_local_object_host(signed_url)


def get_storage_usage(
    owner_name: str, fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem | None = None
) -> float:
    """Get storage usage in GB for a given owner."""
    if fs is None:
        fs = get_object_fs()
    usage = fs.du(get_data_prefix_for_owner(owner_name))
    if isinstance(usage, dict):
        usage = sum(float(v) for v in usage.values())
    return float(usage) / 1e9
