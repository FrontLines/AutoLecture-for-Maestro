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

# Load the bundled icon
icon_path = os.path.join(BASE_DIR, "icon.ico")
if os.path.exists(icon_path):
    image = Image.open(icon_path)
else:
    # Fallback to a plain image if not found
    image = Image.new('RGB', (64, 64), color = (73, 109, 137))

menu = pystray.Menu(
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
