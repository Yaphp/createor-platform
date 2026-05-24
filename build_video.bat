@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\native\build_video_ffmpeg.ps1" -ImageDir "F:\download\谷歌下载\unspokenvideo\images" -CaptionFile "F:\download\谷歌下载\unspokenvideo\captions.txt" -ArchiveRoot "%~dp0" -CaptionMarginTop 260
echo.
if errorlevel 1 echo Build failed. Check the error above.
if not errorlevel 1 echo Build complete. Check the output folder under %~dp0
pause
