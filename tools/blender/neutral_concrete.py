"""Blender texture preparation for the clean concrete material.

Keep the licensed original untouched; pack a neutral color grade into the
editable review scene. Normal, roughness and AO maps retain the source detail.
"""
import bpy
import numpy as np

def neutral_concrete(source):
    image = bpy.data.images.new('Clean concrete neutral color', width=source.size[0], height=source.size[1], alpha=True)
    image.colorspace_settings.name = source.colorspace_settings.name
    pixels = np.empty(len(source.pixels), dtype=np.float32)
    source.pixels.foreach_get(pixels)
    rgba = pixels.reshape(-1, 4)
    gray = np.clip(.20 + .65 * (rgba[:, :3] @ np.array([.2126, .7152, .0722], dtype=np.float32)), 0, 1)
    rgba[:, :3] = gray[:, None]
    image.pixels.foreach_set(pixels)
    image.pack()
    return image
