from PIL import Image
import os

def update_icons():
    source_path = "public/gimmies-app-logo.png"
    
    if not os.path.exists(source_path):
        print(f"Error: {source_path} not found.")
        return

    # Icon sizes to generate
    sizes = {
        "public/gimmies_app_icon.png": (1024, 1024),
        "public/icons/icon-1024.png": (1024, 1024),
        "public/icons/icon-512.png": (512, 512),
        "public/icons/icon-192.png": (192, 192),
        "public/apple-touch-icon.png": (180, 180)
    }

    try:
        img = Image.open(source_path).convert("RGBA")
        print(f"Opened source image: {source_path} ({img.size})")
        
        for path, size in sizes.items():
            # Resize directly since the source is nearly square and solid
            # This ensures the user's exact design is used filling the whole icon
            icon = img.resize(size, Image.Resampling.LANCZOS)
            
            # Save
            os.makedirs(os.path.dirname(path), exist_ok=True)
            icon.save(path)
            print(f"Generated {path}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    update_icons()
