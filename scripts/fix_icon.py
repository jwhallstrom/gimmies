from PIL import Image, ImageDraw

def fix_icon_and_generate_favicon():
    source_path = "public/gimmies-app-logo.png"
    
    try:
        img = Image.open(source_path).convert("RGBA")
        width, height = img.size
        
        # Target green color (sampled from top edge)
        # (17, 124, 50) from previous check
        target_green = (17, 124, 50, 255)
        
        # Create a mask of "white-ish" pixels
        # We'll define white-ish as R,G,B all > 200
        def is_white(pixel):
            return pixel[0] > 200 and pixel[1] > 200 and pixel[2] > 200

        # We will flood fill from the edges
        # Since PIL doesn't have a simple "flood fill replace color with tolerance", 
        # we can do a BFS/DFS or use ImageDraw.floodfill if the color is uniform.
        # But the white is noisy (compression artifacts).
        
        # Alternative: Create a new image with the target green background,
        # and paste the original image on top, but make the white parts transparent first?
        # No, that might make white text transparent.
        
        # BFS Flood Fill approach
        pixels = img.load()
        visited = set()
        queue = []
        
        # Start from all border pixels
        for x in range(width):
            queue.append((x, 0))
            queue.append((x, height-1))
        for y in range(height):
            queue.append((0, y))
            queue.append((width-1, y))
            
        # Filter queue for only white pixels
        queue = [p for p in queue if is_white(pixels[p])]
        
        # Process
        while queue:
            x, y = queue.pop(0)
            if (x, y) in visited:
                continue
            visited.add((x, y))
            
            # Replace pixel
            pixels[x, y] = target_green
            
            # Check neighbors
            for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited and is_white(pixels[nx, ny]):
                        queue.append((nx, ny))
                        
        print("Flood fill complete.")
        
        # Save the fixed master icon
        img.save("public/gimmies_app_icon.png")
        print("Saved fixed public/gimmies_app_icon.png")
        
        # Generate other sizes
        sizes = {
            "public/icons/icon-1024.png": (1024, 1024),
            "public/icons/icon-512.png": (512, 512),
            "public/icons/icon-192.png": (192, 192),
            "public/apple-touch-icon.png": (180, 180)
        }
        
        for path, size in sizes.items():
            resized = img.resize(size, Image.Resampling.LANCZOS)
            resized.save(path)
            print(f"Generated {path}")
            
        # Generate Favicon
        favicon = img.resize((64, 64), Image.Resampling.LANCZOS)
        favicon.save("public/favicon.png")
        print("Generated public/favicon.png")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_icon_and_generate_favicon()
