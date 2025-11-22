from PIL import Image
import os

def create_icon():
    # Configuration
    bg_color = "#14532d" # The green theme color
    logo_path = "public/gimmies-logo.png"
    output_path = "public/gimmies_app_icon.png"
    
    # Icon sizes to generate
    sizes = {
        "public/gimmies_app_icon.png": (1024, 1024),
        "public/icons/icon-1024.png": (1024, 1024),
        "public/icons/icon-512.png": (512, 512),
        "public/icons/icon-192.png": (192, 192),
        "public/apple-touch-icon.png": (180, 180) # Standard apple touch icon size
    }

    try:
        # Open the logo
        if not os.path.exists(logo_path):
            print(f"Error: {logo_path} not found.")
            return

        logo = Image.open(logo_path).convert("RGBA")
        
        for path, size in sizes.items():
            # Create background
            icon = Image.new("RGBA", size, bg_color)
            
            # Calculate logo size (keep some padding, e.g., 80% of icon width)
            target_width = int(size[0] * 0.8)
            aspect_ratio = logo.height / logo.width
            target_height = int(target_width * aspect_ratio)
            
            # Resize logo
            resized_logo = logo.resize((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Calculate position to center
            x = (size[0] - target_width) // 2
            y = (size[1] - target_height) // 2
            
            # Paste logo onto background (using logo alpha channel as mask)
            icon.paste(resized_logo, (x, y), resized_logo)
            
            # Save
            # Ensure directory exists
            os.makedirs(os.path.dirname(path), exist_ok=True)
            icon.save(path)
            print(f"Generated {path}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    create_icon()
