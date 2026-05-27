# MediaPipe 手部模型

`hand_landmarker.task` 为 Google MediaPipe Hand Landmarker 模型（约 7.5 MB）。

放在仓库内可避免部分网络环境下 `storage.googleapis.com` 无法访问，导致他人电脑上摄像头能开但无法识别手型的问题。

首次克隆后若缺少该文件，可在项目根目录执行：

```powershell
Invoke-WebRequest -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -OutFile "assets/models/hand_landmarker.task"
```
