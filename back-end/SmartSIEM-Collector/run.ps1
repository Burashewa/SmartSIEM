# Run collector with project venv (avoids system Python missing deps).
Set-Location $PSScriptRoot
& .\venv\Scripts\python.exe main.py @args
exit $LASTEXITCODE
