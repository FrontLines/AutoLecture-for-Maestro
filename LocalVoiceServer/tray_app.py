import pystray
from PIL import Image
import threading
import uvicorn
import server
import sys
import os
import winreg
import ctypes
import io

# Prevent crashes when running windowless (pythonw.exe) where stdout/stderr are None
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = io.StringIO()

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Setup startup registry key
def set_startup(enable):
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_ALL_ACCESS)
    app_name = "AutoLecture Voice Server"
    
    # Force pythonw.exe to run completely hidden in the background!
    executable = sys.executable
    if executable.lower().endswith("python.exe"):
        executable = executable[:-10] + "pythonw.exe"
        
    app_path = f'"{executable}" "{os.path.abspath(__file__)}"'
    
    if enable:
        winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, app_path)
    else:
        try:
            winreg.DeleteValue(key, app_name)
        except FileNotFoundError:
            pass
    winreg.CloseKey(key)

def check_startup():
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_READ)
        winreg.QueryValueEx(key, "AutoLecture Voice Server")
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False

is_startup_enabled = check_startup()
is_debugging = False

def toggle_startup(icon, item):
    global is_startup_enabled
    is_startup_enabled = not is_startup_enabled
    set_startup(is_startup_enabled)

def toggle_debugging(icon, item):
    global is_debugging
    is_debugging = not is_debugging
    
    hwnd = ctypes.windll.kernel32.GetConsoleWindow()
    
    if is_debugging:
        if not hwnd:
            # We don't have a console, spawn one dynamically!
            ctypes.windll.kernel32.AllocConsole()
            hwnd = ctypes.windll.kernel32.GetConsoleWindow()
            
            # Disable the "X" Close button so they don't accidentally kill the server
            if hwnd:
                hMenu = ctypes.windll.user32.GetSystemMenu(hwnd, False)
                if hMenu:
                    ctypes.windll.user32.DeleteMenu(hMenu, 0xF060, 0x0000) # SC_CLOSE
            
            # Connect stdout to the new console window
            sys.stdout = open("CONOUT$", "w", encoding="utf-8")
            sys.stderr = open("CONOUT$", "w", encoding="utf-8")
            print("==================================================")
            print("AutoLecture Debugging Console")
            print("WARNING: Do NOT click the red 'X' to close this.")
            print("Use the system tray icon to hide the debugging menu!")
            print("==================================================\n")
        else:
            # Console already exists
            ctypes.windll.user32.ShowWindow(hwnd, 5) # SW_SHOW
    else:
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0) # SW_HIDE

def exit_action(icon, item):
    icon.stop()
    os._exit(0)

import urllib.request
import urllib.error
import json
import tkinter as tk
from tkinter import messagebox
import subprocess
import tempfile

CURRENT_VERSION = "1.4"

def check_for_updates(icon, item):
    # Run in a separate thread to not freeze the tray icon
    threading.Thread(target=_run_update_check, daemon=True).start()

def _run_update_check():
    api_url = "https://api.github.com/repos/FrontLines/AutoLecture-for-Maestro/releases/latest"
    try:
        req = urllib.request.Request(api_url, headers={'User-Agent': 'AutoLecture-Updater'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            latest_tag = data.get("tag_name", "")
            
            if latest_tag.startswith("v"):
                latest_version = latest_tag[1:]
            else:
                latest_version = latest_tag
                
            # Very basic version comparison
            if latest_version > CURRENT_VERSION:
                _prompt_update(latest_version)
            else:
                # We only show the "Up to date" popup if they manually clicked the menu item
                root = tk.Tk()
                root.withdraw()
                messagebox.showinfo("AutoLecture Updater", f"You are running the latest version ({CURRENT_VERSION})!")
                root.destroy()
    except Exception as e:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("AutoLecture Updater", f"Failed to check for updates: {e}")
        root.destroy()

def _prompt_update(latest_version):
    root = tk.Tk()
    root.withdraw()
    result = messagebox.askyesno(
        "Update Available!",
        f"AutoLecture v{latest_version} is available!\n\nYou are currently running v{CURRENT_VERSION}.\nWould you like to download and install it now?"
    )
    if result:
        _download_and_install(latest_version)
    root.destroy()

def _download_and_install(latest_version):
    # The permalink to the specific asset
    download_url = f"https://github.com/FrontLines/AutoLecture-for-Maestro/releases/download/v{latest_version}/AutoLecture_for_Maestro_Setup_v{latest_version}.exe"
    
    try:
        root = tk.Tk()
        root.withdraw()
        
        # Download the file to the temp directory
        temp_dir = tempfile.gettempdir()
        installer_path = os.path.join(temp_dir, f"AutoLecture_Update_v{latest_version}.exe")
        
        # For simplicity, we just download it synchronously. A real app might show a progress bar.
        req = urllib.request.Request(download_url, headers={'User-Agent': 'AutoLecture-Updater'})
        with urllib.request.urlopen(req) as response, open(installer_path, 'wb') as out_file:
            out_file.write(response.read())
            
        messagebox.showinfo("Update Downloaded", "The update has been downloaded and will now install silently in the background.\n\nThe server will restart automatically.")
        root.destroy()
        
        # Launch the installer silently
        subprocess.Popen([installer_path, '/SILENT'])
        
        # Kill the current tray app so the files can be overwritten!
        icon.stop()
        os._exit(0)
        
    except Exception as e:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Update Error", f"Failed to download or run the update:\n{e}")
        root.destroy()

# Load the bundled icon
icon_path = os.path.join(BASE_DIR, "icon.ico")
if os.path.exists(icon_path):
    image = Image.open(icon_path)
else:
    # Fallback to a plain image if not found
    image = Image.new('RGB', (64, 64), color = (73, 109, 137))

menu = pystray.Menu(
    pystray.MenuItem("Check for Updates", check_for_updates),
    pystray.MenuItem("Run at Startup", toggle_startup, checked=lambda item: is_startup_enabled),
    pystray.MenuItem("Show Debugging", toggle_debugging, checked=lambda item: is_debugging),
    pystray.MenuItem("Exit", exit_action)
)

icon = pystray.Icon("AutoLecture", image, "AutoLecture Voice Server", menu)

# Start the FastAPI server in a separate thread
def run_server():
    uvicorn.run(server.app, host="127.0.0.1", port=8000, log_level="error")

threading.Thread(target=run_server, daemon=True).start()

# Run the system tray icon (this blocks the main thread)
icon.run()
