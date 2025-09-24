from picamera2 import Picamera2
import cv2
import time

# Initialize camera
picam2 = Picamera2()

# Use preview configuration (PiSP applies full ISP pipeline)
config = picam2.create_preview_configuration(main={"size": (640, 480)})
picam2.configure(config)
picam2.start()

# Allow AWB and auto exposure to stabilize
time.sleep(3)

print("Camera ready! Press 'c' to capture photo, 'v' to record 5s video, 'q' to quit.")

while True:
    # Capture frame
    frame = picam2.capture_array()  # Already processed by PiSP

    # Convert RGB -> BGR for OpenCV
    frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

    # Display
    cv2.imshow("Camera Preview", frame_bgr)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        cv2.imwrite("capture.jpg", frame_bgr)
        print("Photo saved as capture.jpg")
    elif key == ord('v'):
        print("Recording 5-second video...")
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter('video.avi', fourcc, 20.0, (640, 480))
        start_time = time.time()
        while time.time() - start_time < 5:
            f = picam2.capture_array()
            f_bgr = cv2.cvtColor(f, cv2.COLOR_RGB2BGR)
            out.write(f_bgr)
        out.release()
        print("Video saved as video.avi")

picam2.stop()
cv2.destroyAllWindows()
