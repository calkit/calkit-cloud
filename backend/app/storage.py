"""Functionality for managing object storage."""

import json
import os
from typing import Any, Literal

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


def get_upload_chunk_size(backend: Literal["s3", "gcs"] | None = None) -> int:
    """Get the chunk/part size for the specified backend in bytes."""
    if backend is None:
        backend = get_backend()
    return (
        MULTIPART_PART_SIZE_BYTES
        if backend == "s3"
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


def _generate_multipart_urls(
    fpath: str,
    estimated_part_count: int,
    part_size_bytes: int,
    expires: int,
    fs: s3fs.S3FileSystem,
    content_type: str | None = None,
) -> dict:
    """Generate presigned URLs for S3 multipart upload.

    Returns a dict with:
    - bucket: bucket name
    - key: object key
    - upload_id: multipart upload ID
    - part_urls: list of presigned URLs for each part
    - complete_url: presigned URL to complete the upload
    """
    # Parse bucket and key from fpath (e.g., "s3://bucket/path/to/object")
    if fpath.startswith("s3://"):
        bucket, _, key = fpath[5:].partition("/")
    else:
        raise ValueError(f"Invalid S3 path: {fpath}")
    # Access the underlying boto3 client
    s3_client: Any = fs.s3
    # Initiate multipart upload
    mpu = s3_client.create_multipart_upload(
        Bucket=bucket,
        Key=key,
        **({"ContentType": content_type} if content_type else {}),
    )
    upload_id = mpu["UploadId"]
    # Generate presigned URLs for each part
    part_urls = []
    for part_number in range(1, estimated_part_count + 1):
        part_url = s3_client.generate_presigned_url(
            "upload_part",
            Params={
                "Bucket": bucket,
                "Key": key,
                "PartNumber": part_number,
                "UploadId": upload_id,
            },
            ExpiresIn=expires,
        )
        part_urls.append(_replace_local_object_host(part_url))
    # Generate presigned URL for completing the multipart upload
    complete_url = s3_client.generate_presigned_url(
        "complete_multipart_upload",
        Params={
            "Bucket": bucket,
            "Key": key,
            "UploadId": upload_id,
        },
        ExpiresIn=expires,
    )
    complete_url = _replace_local_object_host(complete_url)
    return {
        "bucket": bucket,
        "key": key,
        "upload_id": upload_id,
        "part_urls": part_urls,
        "complete_url": complete_url,
    }


def get_object_url(
    fpath: str,
    fname: str | None = None,
    expires: int = 3600 * 24,
    fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem | None = None,
    method: Literal["get", "put"] = "get",
    *,
    content_type: str | None = None,
    **kwargs,
) -> str:
    """Get a presigned URL for an object in object storage.

    For multipart/chunked uploads, use get_multipart_upload_info() instead.
    """
    if fs is None:
        fs = get_object_fs()
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


def get_multipart_upload_info(
    fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem,
    fpath: str,
    upload_size_bytes: int,
    expires: int = 900,
    content_type: str | None = None,
) -> dict:
    """Get multipart/chunked upload info with all presigned URLs.

    For S3: Returns dict with upload_id, bucket, key, part_urls, complete_url
    For GCS: Returns dict with init_url for resumable upload
    """
    if isinstance(fs, s3fs.S3FileSystem):
        part_size = get_upload_chunk_size("s3")
        estimated_part_count = (upload_size_bytes + part_size - 1) // part_size
        return _generate_multipart_urls(
            fpath=fpath,
            estimated_part_count=estimated_part_count,
            part_size_bytes=part_size,
            expires=expires,
            fs=fs,
            content_type=content_type,
        )
    elif isinstance(fs, gcsfs.GCSFileSystem):
        part_size = get_upload_chunk_size("gcs")
        estimated_part_count = (upload_size_bytes + part_size - 1) // part_size
        try:
            init_url = fs.sign(
                fpath,
                expiration=expires,
                method="POST",
            )
        except Exception:
            init_url = None
        if init_url is None:
            init_url = fs.sign(
                fpath,
                expiration=expires,
                method="PUT",
            )
        if init_url is None:
            raise RuntimeError("Failed to generate chunked init URL")
        return {
            "init_url": init_url,
            "estimated_chunk_count": estimated_part_count,
            "chunk_size_bytes": part_size,
        }
    else:
        raise ValueError("Unsupported filesystem type")


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
