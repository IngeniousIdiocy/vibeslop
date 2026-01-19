#!/usr/bin/env python3
"""
Nano Banana Pro MCP Server
Local MCP server exposing Google's Gemini 3 Pro Image (Nano Banana Pro) via Google's API.

Features:
- Generate images from text prompts
- Edit existing images
- Returns images inline for Claude to view and evaluate
- Supports iterative refinement with feedback (max 3 attempts)

Usage:
    1. pip install mcp httpx Pillow
    2. Set GEMINI_API_KEY environment variable
    3. Add to Claude Desktop config
"""

import os
import json
import base64
import httpx
from io import BytesIO
from datetime import datetime
from pathlib import Path
from PIL import Image as PILImage
from mcp.server.fastmcp import FastMCP, Image

mcp = FastMCP("nano-banana-pro")

# Constants
MAX_IMAGE_SIZE_BYTES = 800_000  # 800KB target to stay under Claude's 1MB limit
MAX_DIMENSION = 1024  # Max width/height for resizing

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL = "gemini-3-pro-image-preview"


def get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    return key


def compress_image_for_claude(image_bytes: bytes) -> bytes:
    """
    Compress and resize image to stay under Claude's 1MB limit.
    Returns PNG bytes optimized for inline display.
    """
    img = PILImage.open(BytesIO(image_bytes))

    # Convert to RGB if necessary (handles RGBA, palette modes, etc.)
    if img.mode in ('RGBA', 'LA', 'P'):
        background = PILImage.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if dimensions exceed max
    if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), PILImage.Resampling.LANCZOS)

    # Try PNG first, then JPEG with decreasing quality if too large
    buffer = BytesIO()
    img.save(buffer, format='PNG', optimize=True)

    if buffer.tell() <= MAX_IMAGE_SIZE_BYTES:
        return buffer.getvalue()

    # Fall back to JPEG with quality reduction
    for quality in [85, 70, 55, 40]:
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        if buffer.tell() <= MAX_IMAGE_SIZE_BYTES:
            return buffer.getvalue()

    # Last resort: resize further
    while buffer.tell() > MAX_IMAGE_SIZE_BYTES and img.width > 256:
        img.thumbnail((img.width // 2, img.height // 2), PILImage.Resampling.LANCZOS)
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=40, optimize=True)

    return buffer.getvalue()


def extract_image_from_response(response: dict) -> tuple[bytes | None, str | None]:
    """Extract image bytes and text from Gemini response."""
    candidates = response.get("candidates", [])
    if not candidates:
        return None, None
    
    content = candidates[0].get("content", {})
    parts = content.get("parts", [])
    
    image_bytes = None
    text = None
    
    for part in parts:
        if "inlineData" in part:
            b64 = part["inlineData"].get("data")
            if b64:
                image_bytes = base64.b64decode(b64)
        if "text" in part:
            text = part["text"]
    
    return image_bytes, text


@mcp.tool()
async def generate_image(
    prompt: str,
    save_to_file: bool = True,
    output_dir: str = "~/Pictures/nano-banana"
):
    """
    Generate an image using Nano Banana Pro (Gemini 3 Pro Image).

    The generated image is returned inline so you can view and evaluate it.
    If the image doesn't match your expectations, use refine_image() with
    specific feedback to improve it (up to 3 refinement attempts).

    Args:
        prompt: Detailed description of the image to generate. Describe the scene,
                style, lighting, composition - be specific about what you want.
        save_to_file: Save the generated image to disk (default: True).
        output_dir: Directory for saved images.

    Returns:
        The generated image (viewable inline) or error message.
    """
    try:
        api_key = get_api_key()
        url = f"{API_BASE}/{MODEL}:generateContent"

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"]
            }
        }

        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()

        image_bytes, text = extract_image_from_response(result)

        if not image_bytes:
            return f"No image generated. Model response: {text or 'No response'}"

        # Save original to file if requested
        if save_to_file:
            out_path = Path(output_dir).expanduser()
            out_path.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_prompt = "".join(c if c.isalnum() or c in " -_" else "" for c in prompt[:30]).strip().replace(" ", "_")
            filename = f"{timestamp}_{safe_prompt}.png"
            filepath = out_path / filename
            filepath.write_bytes(image_bytes)

        # Compress for inline display and return Image object
        compressed = compress_image_for_claude(image_bytes)
        return Image(data=compressed, format="png")

    except httpx.HTTPStatusError as e:
        return f"API error {e.response.status_code}: {e.response.text}"
    except Exception as e:
        return f"Error: {str(e)}"


@mcp.tool()
async def edit_image(
    prompt: str,
    image_path: str,
    save_to_file: bool = True,
    output_dir: str = "~/Pictures/nano-banana"
):
    """
    Edit an existing image using Nano Banana Pro.

    The edited image is returned inline so you can view and evaluate it.
    If the edit doesn't match your expectations, call this again with
    refined instructions.

    Args:
        prompt: How to edit or transform the image (e.g., "Make it a watercolor painting",
                "Add a sunset in the background", "Remove the text").
        image_path: Local path to the source image.
        save_to_file: Save the result to disk (default: True).
        output_dir: Directory for saved images.

    Returns:
        The edited image (viewable inline) or error message.
    """
    try:
        api_key = get_api_key()

        # Load and encode source image
        src_path = Path(image_path).expanduser()
        if not src_path.exists():
            return f"Image not found: {src_path}"

        image_data = base64.b64encode(src_path.read_bytes()).decode("utf-8")

        # Determine mime type
        suffix = src_path.suffix.lower()
        mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
        mime_type = mime_map.get(suffix, "image/png")

        url = f"{API_BASE}/{MODEL}:generateContent"

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": mime_type, "data": image_data}}
                ]
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"]
            }
        }

        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()

        image_bytes, text = extract_image_from_response(result)

        if not image_bytes:
            return f"No image generated. Model response: {text or 'No response'}"

        # Save original to file if requested
        if save_to_file:
            out_path = Path(output_dir).expanduser()
            out_path.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_prompt = "".join(c if c.isalnum() or c in " -_" else "" for c in prompt[:30]).strip().replace(" ", "_")
            filename = f"{timestamp}_edit_{safe_prompt}.png"
            filepath = out_path / filename
            filepath.write_bytes(image_bytes)

        # Compress for inline display and return Image object
        compressed = compress_image_for_claude(image_bytes)
        return Image(data=compressed, format="png")

    except httpx.HTTPStatusError as e:
        return f"API error {e.response.status_code}: {e.response.text}"
    except Exception as e:
        return f"Error: {str(e)}"


@mcp.tool()
async def refine_image(
    original_prompt: str,
    feedback: str,
    attempt_number: int = 1,
    max_attempts: int = 3,
    save_to_file: bool = True,
    output_dir: str = "~/Pictures/nano-banana"
):
    """
    Refine a previously generated image based on your evaluation feedback.

    Use this after viewing an image from generate_image() that didn't meet expectations.
    Combines the original prompt with your specific feedback to create an improved image.

    Args:
        original_prompt: The original image generation prompt.
        feedback: Specific feedback on what was wrong and how to improve it.
                  Be detailed: "The lighting is too dark, make it brighter with
                  warm afternoon sun" is better than "fix the lighting".
        attempt_number: Current refinement attempt (1-3). Will refuse if > max_attempts.
        max_attempts: Maximum refinement attempts allowed (default: 3).
        save_to_file: Save the refined image to disk (default: True).
        output_dir: Directory for saved images.

    Returns:
        The refined image (viewable inline) or error/limit message.
    """
    if attempt_number > max_attempts:
        return f"Maximum refinement attempts ({max_attempts}) reached. Consider starting fresh with a revised prompt."

    # Combine original prompt with feedback into an improved prompt
    refined_prompt = f"""Based on this original request: "{original_prompt}"

Please generate an improved version addressing this feedback: {feedback}

Generate a new image that incorporates these improvements while maintaining the core intent of the original request."""

    try:
        api_key = get_api_key()
        url = f"{API_BASE}/{MODEL}:generateContent"

        payload = {
            "contents": [{
                "parts": [{"text": refined_prompt}]
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"]
            }
        }

        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()

        image_bytes, text = extract_image_from_response(result)

        if not image_bytes:
            return f"No image generated. Model response: {text or 'No response'}"

        # Save to file if requested
        if save_to_file:
            out_path = Path(output_dir).expanduser()
            out_path.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_prompt = "".join(c if c.isalnum() or c in " -_" else "" for c in original_prompt[:20]).strip().replace(" ", "_")
            filename = f"{timestamp}_refined_v{attempt_number}_{safe_prompt}.png"
            filepath = out_path / filename
            filepath.write_bytes(image_bytes)

        # Compress for inline display and return Image object
        compressed = compress_image_for_claude(image_bytes)
        return Image(data=compressed, format="png")

    except httpx.HTTPStatusError as e:
        return f"API error {e.response.status_code}: {e.response.text}"
    except Exception as e:
        return f"Error: {str(e)}"


@mcp.tool()
async def list_images(output_dir: str = "~/Pictures/nano-banana", limit: int = 10) -> str:
    """
    List recently generated images.
    
    Args:
        output_dir: Directory to scan.
        limit: Max images to list.
    
    Returns:
        JSON list of image files.
    """
    try:
        out_path = Path(output_dir).expanduser()
        if not out_path.exists():
            return json.dumps({"success": True, "images": [], "message": "Directory does not exist"}, indent=2)
        
        images = sorted(out_path.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]
        
        return json.dumps({
            "success": True,
            "directory": str(out_path),
            "count": len(images),
            "images": [{"filename": img.name, "path": str(img), "size_kb": round(img.stat().st_size / 1024, 1)} for img in images]
        }, indent=2)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
