"""Functionality for managing object storage."""

import os
from typing import Literal

import gcsfs
import s3fs
from app.config import settings
from google.cloud import storage as gcs


def remove_gcs_content_type(fpath):
    client = gcs.Client()
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
    return gcsfs.GCSFileSystem()


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


def get_object_url(
    fpath: str,
    fname: str = None,
    expires: int = 3600 * 24,
    fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem | None = None,
    method: Literal["get", "put"] = "get",
    **kwargs,
) -> str:
    """Get a presigned URL for an object in object storage."""
    if fs is None:
        fs = get_object_fs()
    if settings.ENVIRONMENT == "local":
        kws = {}
        if fname is not None:
            kws["ResponseContentDisposition"] = f"filename={fname}"
            if fname.endswith(".pdf"):
                kws["ResponseContentType"] = "application/pdf"
        kws["client_method"] = f"{method}_object"
    else:
        kws = {}
        if fname is not None:
            kws["response_disposition"] = f"filename={fname}"
            if fname.endswith(".pdf"):
                kws["response_type"] = "application/pdf"
        kws["method"] = method.upper()
    url: str = fs.sign(fpath, expiration=expires, **(kws | kwargs))
    if settings.ENVIRONMENT == "local":
        url = url.replace(
            "http://minio:9000", f"http://objects.{settings.DOMAIN}"
        )
    return url


def get_storage_usage(
    owner_name: str, fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem | None = None
) -> float:
    """Get storage usage in GB for a given owner."""
    if fs is None:
        fs = get_object_fs()
    return fs.du(get_data_prefix_for_owner(owner_name)) / 1e9
