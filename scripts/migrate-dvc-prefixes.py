"""This script iterates through all object storage keys to add files/md5/
prefixes to DVC data file paths that are missing them, for backward
compatibility with existing data.

It should be run on the backend machine in a directory that can import ``app``.
"""

import os

from app.storage import (
    get_object_fs,
    get_data_prefix,
    get_data_prefix_for_owner,
)

dry_run = True  # Set to False to actually perform the migration

fs = get_object_fs()
data_prefix = get_data_prefix()

# Iterate over all owners and projects, renaming any two character folders
# to prepend 'files/md5/' to match the new DVC path structure
for owner_path in fs.ls(data_prefix, False):
    owner_name = os.path.basename(owner_path)
    owner_prefix = get_data_prefix_for_owner(owner_name)

    for project_path in fs.ls(owner_prefix, False):
        project_name = os.path.basename(project_path)
        project_prefix = f"{owner_prefix}/{project_name}"

        for item_path in fs.ls(project_prefix, False):
            item_name = os.path.basename(item_path)
            if len(item_name) == 2 and all(c.isalnum() for c in item_name):
                old_path = (
                    f"{data_prefix}/{owner_name}/{project_name}/{item_name}"
                )
                new_path = (
                    f"{data_prefix}/{owner_name}/{project_name}"
                    f"/files/md5/{item_name}"
                )
                print(f"Renaming {old_path} to {new_path}")
                if not dry_run:
                    try:
                        fs.rename(old_path, new_path)
                    except Exception as e:
                        print(f"Error renaming {old_path}: {e}")
