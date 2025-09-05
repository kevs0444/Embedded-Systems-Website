import time
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from PIL import Image, ImageDraw, ImageFont

# -------------------- OLED Setup --------------------
serial = i2c(port=1, address=0x3C)
oled = ssd1306(serial, width=128, height=64)

# -------------------- Clear display --------------------
blank = Image.new("1", (oled.width, oled.height))  # completely blank image
oled.display(blank)

# -------------------- Draw Hello World --------------------
font = ImageFont.load_default()
image = Image.new("1", (oled.width, oled.height))  # new blank image
draw = ImageDraw.Draw(image)
draw.text((0, 0), "Hello, World!", font=font, fill=255)

oled.display(image)

print("OLED should show 'Hello, World!' now.")
time.sleep(5)

# -------------------- Clear after 5 seconds --------------------
oled.display(blank)
print("OLED cleared.")
