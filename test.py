import time
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106
from luma.core.render import canvas
from PIL import ImageFont, ImageDraw, Image

# OLED setup
serial = i2c(port=1, address=0x3C)
oled = sh1106(serial)
oled.clear()

# Font setup
font_path = "/home/SystemShapers/Downloads/DejaVuSans-Bold.ttf"
font = ImageFont.truetype(font_path, 10)  # Adjust font size for readability

# Text lines
lines = [
    "Mar Kevin Alcantara",
    "Bernie Berongoy",
    "Reymart Llona",
    "Paul Andrew Relevo",
    "Yuri Lorenz Sagadraca",
    "#6 | PCEIT-03-601P"
]

# Prepare drawing
WIDTH, HEIGHT = oled.width, oled.height
image = Image.new("1", (WIDTH, HEIGHT), 0)
draw = ImageDraw.Draw(image)

# Scroll animation
text_y = HEIGHT
while text_y > -len(lines) * 12:  # Adjust spacing dynamically
    draw.rectangle((0, 0, WIDTH, HEIGHT), outline=0, fill=0)  # Clear frame
    y_offset = text_y
    for line in lines:
        draw.text((5, y_offset), line, font=font, fill=255)
        y_offset += 12  # Line spacing
    oled.display(image)  # Show frame
    text_y -= 2          # Adjust scrolling speed
    time.sleep(0.1)

oled.clear()
print("Scrolling text animation completed.")
