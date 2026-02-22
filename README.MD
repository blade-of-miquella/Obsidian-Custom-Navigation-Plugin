# Obsidian Auto-Navigation Plugin

A lightweight plugin that automatically generates and maintains navigation files based on your vault's folder structure.

## Demo

[https://github.com/user-attachments/assets/0d9098a3-5c78-4508-8b67-650000402dca]

## What it does

This plugin automates the creation of "Map of Content" (MOC) files for your vault:
- **Root Navigation**: Generates a main navigation file in your root folder listing all top-level categories.
- **Folder Navigation**: Creates a dedicated navigation file inside each second-level folder.
- **Deep Nesting**: Recursively scans subfolders and lists their contents (sub-folders and `.md` notes) in a clean, hierarchical tree.
- **Live Updates**: Automatically refreshes the navigation files whenever you create, rename, or delete files/folders (using a 500ms debounce for performance).

You can customize the plugin behavior in the settings:
- **Excluded Folders**: Comma-separated list of folders to ignore (e.g., `Templates, Attachments, Archive`).
- **Root Filename**: Change the name of the primary navigation file (default is `Navigation`).

I built this plugin **purely for myself**, so the logic and structure are tuned to my specific needs. You can freely copy it and do whatever you want.
