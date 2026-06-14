# 将 videos/ 内 .mov 转为「快速启动」.mp4（moov 在文件头，网页可秒开）
# 需安装 ffmpeg：https://ffmpeg.org/download.html
# 用法：.\scripts\remux-faststart.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$videos = Join-Path $root "videos"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "未找到 ffmpeg。请安装后重试。" -ForegroundColor Red
  exit 1
}

Get-ChildItem $videos -File -Include *.mov,*.MOV | ForEach-Object {
  $out = Join-Path $videos ($_.BaseName + ".mp4")
  if (Test-Path $out) {
    Write-Host "跳过 $($_.Name)（已有 $($out.Name)）"
    return
  }
  Write-Host "转换 $($_.Name) -> $($out.Name) ..."
  ffmpeg -y -i $_.FullName -c copy -movflags +faststart $out
}

Write-Host ""
Write-Host "完成。请运行："
Write-Host "  python scripts/build-video-manifest.py"
Write-Host "  python scripts/build-story-from-videoline.py"
Write-Host "然后将新 .mp4 上传到 GitHub Release videos-v2。"
