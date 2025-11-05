#!/usr/bin/env python3
"""
Quick installer for Direct P2P Mesh Chat
Checks dependencies and provides setup guidance
"""
import sys
import subprocess
import platform

def check_python_version():
    """Check Python version"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print("❌ Python 3.7+ required")
        print(f"   Current: Python {version.major}.{version.minor}.{version.micro}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def check_bluetooth():
    """Check if Bluetooth library is available"""
    try:
        import bluetooth
        print("✅ Bluetooth support (pybluez) installed")
        return True
    except ImportError:
        pass
    
    try:
        import bleak
        print("✅ Bluetooth support (bleak) installed")
        return True
    except ImportError:
        pass
    
    print("⚠️  Bluetooth library not found")
    return False

def check_tkinter():
    """Check if tkinter is available"""
    try:
        import tkinter
        print("✅ tkinter (GUI) available")
        return True
    except ImportError:
        print("❌ tkinter not found")
        return False

def install_bluetooth():
    """Attempt to install Bluetooth library"""
    system = platform.system()
    print("\n📦 Installing Bluetooth support...")
    
    try:
        if system == "Windows":
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pybluez"])
        elif system == "Darwin":  # macOS
            print("   Trying pybluez2...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pybluez2"])
        else:  # Linux
            print("   Installing pybluez...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pybluez"])
        
        print("✅ Bluetooth library installed")
        return True
    except subprocess.CalledProcessError:
        print("⚠️  Auto-install failed. Try manual install:")
        if system == "Darwin":
            print("   pip install bleak")
        else:
            print("   pip install pybluez")
        return False

def main():
    print("=" * 60)
    print("  🌐 Direct P2P Mesh Chat - Dependency Checker")
    print("=" * 60)
    print()
    
    print("Checking requirements...")
    print()
    
    # Check Python
    if not check_python_version():
        sys.exit(1)
    
    # Check tkinter
    if not check_tkinter():
        system = platform.system()
        if system == "Linux":
            print("\n   Install: sudo apt-get install python3-tk")
        elif system == "Darwin":
            print("\n   Install: brew install python-tk")
        sys.exit(1)
    
    # Check/install Bluetooth
    bt_ok = check_bluetooth()
    if not bt_ok:
        response = input("\n❓ Install Bluetooth support now? [Y/n]: ").strip().lower()
        if response in ["", "y", "yes"]:
            bt_ok = install_bluetooth()
    
    print("\n" + "=" * 60)
    if bt_ok:
        print("✅ All requirements satisfied!")
        print("\nRun the app:")
        print("  python src/gui/gui_chat.py")
    else:
        print("⚠️  Bluetooth missing - WiFi Hotspot mode still works")
        print("\nRun the app (WiFi mode only):")
        print("  python src/gui/gui_chat.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
