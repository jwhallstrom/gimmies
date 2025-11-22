from PIL import Image
import statistics

def analyze_logo_color():
    try:
        img = Image.open("public/gimmies-logo.png").convert("RGBA")
        # Get non-transparent pixels
        pixels = []
        data = img.getdata()
        for item in data:
            if item[3] > 128: # If alpha > 50%
                pixels.append(item[:3])
        
        if not pixels:
            print("Logo seems empty/transparent")
            return

        # Calculate average brightness
        brightness = [0.299*r + 0.587*g + 0.114*b for r,g,b in pixels]
        avg_brightness = statistics.mean(brightness)
        
        print(f"Average brightness: {avg_brightness}")
        if avg_brightness > 128:
            print("Logo is Light")
        else:
            print("Logo is Dark")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_logo_color()
