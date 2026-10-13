#!/usr/bin/env python3
"""Package a compiled standalone application, excluding private runtime files."""
from pathlib import Path
import hashlib
import shutil
import tarfile
import tempfile

root = Path(__file__).resolve().parents[1]
archive = root / 'saltillo-production.tgz'
with tempfile.TemporaryDirectory(prefix='saltillo-package-') as folder:
    dest = Path(folder)
    shutil.copytree(root / '.next/standalone', dest, dirs_exist_ok=True)
    shutil.copytree(root / '.next/static', dest / '.next/static', dirs_exist_ok=True)
    if (root / 'public').exists():
        shutil.copytree(root / 'public', dest / 'public')
    shutil.copytree(root / 'ops', dest / 'ops',
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    (dest / 'ops/basicdeploy-boot.sh').chmod(0o755)
    for path in dest.rglob('*'):
        if path.is_file() and (path.name.startswith('.env') or
                path.name.endswith('.log') or path.name == 'catalog.json'):
            raise RuntimeError('Private file detected; refusing to package')
    with tarfile.open(archive, 'w:gz') as tar:
        for path in sorted(dest.iterdir()):
            tar.add(path, arcname=path.name)
sha = hashlib.sha256(archive.read_bytes()).hexdigest()
(root / 'saltillo-production.sha256').write_text(sha + '  saltillo-production.tgz\n')
print('Standalone package created:', archive.stat().st_size, 'bytes')
