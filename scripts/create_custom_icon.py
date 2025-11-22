from PIL import Image, ImageDraw
import os

def create_custom_icon():
    # Config
    bg_color = "#14532d"  # Brand Green
    hole_color = "#0f391e" # Darker green/black for hole
    stick_color = "#e5e7eb" # Light gray
    flag_color = "#ef4444" # Red
    
    logo_path = "public/gimmies-logo.png"
    
    sizes = {
        "public/gimmies_app_icon.png": (1024, 1024),
        "public/icons/icon-1024.png": (1024, 1024),
        "public/icons/icon-512.png": (512, 512),
        "public/icons/icon-192.png": (192, 192),
        "public/apple-touch-icon.png": (180, 180)
    }

    if not os.path.exists(logo_path):
        print("Logo not found")
        return

    logo = Image.open(logo_path).convert("RGBA")

    for path, size in sizes.items():
        width, height = size
        
        # 1. Create Background
        icon = Image.new("RGBA", size, bg_color)
        draw = ImageDraw.Draw(icon)
        
        # Scale factors
        scale = width / 1024.0
        
        # 2. Draw Hole (Ellipse)
        hole_w = 400 * scale
        hole_h = 120 * scale
        hole_x1 = (width - hole_w) / 2
        hole_y1 = height - (200 * scale)
        hole_x2 = hole_x1 + hole_w
        hole_y2 = hole_y1 + hole_h
        draw.ellipse([hole_x1, hole_y1, hole_x2, hole_y2], fill=hole_color)
        
        # 3. Draw Flagstick
        stick_w = 12 * scale
        stick_x1 = (width - stick_w) / 2
        stick_y1 = hole_y1 + (hole_h / 2) # Center of hole
        stick_y2 = 150 * scale # Top of stick
        draw.rectangle([stick_x1, stick_y2, stick_x1 + stick_w, stick_y1], fill=stick_color)
        
        # 4. Draw Flag (Triangle)
        # Points: Top-Left (on stick), Top-Right (tip), Bottom-Left (on stick)
        flag_h = 200 * scale
        flag_w = 300 * scale
        p1 = (stick_x1 + stick_w, stick_y2)
        p2 = (stick_x1 + stick_w + flag_w, stick_y2 + (flag_h / 2))
        p3 = (stick_x1 + stick_w, stick_y2 + flag_h)
        draw.polygon([p1, p2, p3], fill=flag_color)
        
        # 5. Place Logo
        # Resize logo to fit nicely (e.g., 80% width)
        target_logo_w = int(width * 0.85)
        aspect = logo.height / logo.width
        target_logo_h = int(target_logo_w * aspect)
        
        resized_logo = logo.resize((target_logo_w, target_logo_h), Image.Resampling.LANCZOS)
        
        # Center logo vertically, maybe slightly down to not cover the flag too much
        logo_x = (width - target_logo_w) // 2
        logo_y = (height - target_logo_h) // 2 + int(50 * scale) # Shift down a bit
        
        icon.paste(resized_logo, (logo_x, logo_y), resized_logo)
        
        # Save
        os.makedirs(os.path.dirname(path), exist_ok=True)
        icon.save(path)
        print(f"Generated {path}")

if __name__ == "__main__":
    create_custom_icon()
