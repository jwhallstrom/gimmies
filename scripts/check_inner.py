from PIL import Image

def check_inner_color():
    try:
        img = Image.open("public/gimmies-app-logo.png").convert("RGBA")
        width, height = img.size
        
        # Check a point slightly inside (e.g., 10% in)
        x = width // 10
        y = height // 10
        
        pixel = img.getpixel((x, y))
        print(f"Pixel at ({x}, {y}): {pixel}")
        
        # Check center
        center_pixel = img.getpixel((width//2, height//2))
        print(f"Pixel at center: {center_pixel}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_inner_color()
