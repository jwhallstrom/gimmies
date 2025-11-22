from PIL import Image

def check_corners():
    try:
        img = Image.open("public/gimmies-app-logo.png").convert("RGBA")
        width, height = img.size
        
        # Check corners
        corners = [
            (0, 0),             # Top-left
            (width-1, 0),       # Top-right
            (0, height-1),      # Bottom-left
            (width-1, height-1) # Bottom-right
        ]
        
        print(f"Image size: {width}x{height}")
        for x, y in corners:
            pixel = img.getpixel((x, y))
            print(f"Corner ({x}, {y}): {pixel}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_corners()
