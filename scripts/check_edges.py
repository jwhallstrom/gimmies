from PIL import Image

def check_edges():
    try:
        img = Image.open("public/gimmies-app-logo.png").convert("RGBA")
        width, height = img.size
        
        points = [
            (width//2, 0),          # Top mid
            (width//2, height-1),   # Bottom mid
            (0, height//2),         # Left mid
            (width-1, height//2)    # Right mid
        ]
        
        for x, y in points:
            print(f"Point ({x}, {y}): {img.getpixel((x, y))}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_edges()
