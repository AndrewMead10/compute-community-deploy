import os
import platform
import subprocess
import sys
import venv
from pathlib import Path

def run_command(command, shell=False):
    """Run a command and return its output"""
    try:
        result = subprocess.run(
            command,
            shell=shell,
            check=True,
            capture_output=True,
            text=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        print(f"Error output: {e.stderr}")
        raise

def check_rust():
    """Check if Rust is installed and install if needed"""
    try:
        run_command(["rustc", "--version"])
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Installing Rust...")
        if platform.system() == "Windows":
            # TODO: Add Windows support
            raise NotImplementedError("Windows support not yet implemented")
        else:
            run_command(
                'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
                shell=True
            )
            # Update PATH to include cargo
            os.environ["PATH"] = f"{str(Path.home())}/.cargo/bin:{os.environ['PATH']}"

def install_system_dependencies():
    """Install required system dependencies"""
    system = platform.system()
    if system == "Linux":
        # Check if we're on a Debian-based system
        if os.path.exists("/usr/bin/apt-get"):
            run_command(["sudo", "apt-get", "update"])
            run_command([
                "sudo", "apt-get", "install", "-y",
                "build-essential", "curl", "libssl-dev",
                "gcc", "protobuf-compiler", "cmake"
            ])
        # TODO: Add support for other Linux distributions
    elif system == "Darwin":  # macOS
        try:
            run_command(["brew", "--version"])
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Installing Homebrew...")
            run_command(
                '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
                shell=True
            )
        run_command(["brew", "install", "protobuf", "cmake"])
    else:
        raise NotImplementedError(f"System {system} not supported yet")

def setup_virtual_env(venv_path):
    """Create and activate a virtual environment"""
    venv.create(venv_path, with_pip=True)
    
    # Get the path to the activated virtual environment's Python
    if platform.system() == "Windows":
        venv_python = os.path.join(venv_path, "Scripts", "python.exe")
    else:
        venv_python = os.path.join(venv_path, "bin", "python")
    
    return venv_python

def build_tgi(venv_python, workspace_dir):
    """Clone and build text-generation-inference"""
    tgi_dir = os.path.join(workspace_dir, "text-generation-inference")
    if not os.path.exists(tgi_dir):
        run_command(["git", "clone", "https://github.com/huggingface/text-generation-inference", tgi_dir])
    
    os.chdir(tgi_dir)
    os.environ["BUILD_EXTENSIONS"] = "True"
    run_command([venv_python, "-m", "pip", "install", "--upgrade", "pip"])
    run_command(["make", "install"])
    os.chdir(workspace_dir)

def setup_tgi(workspace_dir=None):
    """Main setup function that can be called programmatically"""
    if workspace_dir is None:
        workspace_dir = os.getcwd()
    
    print("Starting TGI setup...")
    
    # Create .tgi directory in workspace if it doesn't exist
    tgi_dir = os.path.join(workspace_dir, ".tgi")
    os.makedirs(tgi_dir, exist_ok=True)
    
    # Install system dependencies
    print("Installing system dependencies...")
    install_system_dependencies()
    
    # Check and install Rust
    print("Checking Rust installation...")
    check_rust()
    
    # Setup virtual environment
    print("Setting up virtual environment...")
    venv_path = os.path.join(tgi_dir, "venv")
    venv_python = setup_virtual_env(venv_path)
    
    # Build TGI
    print("Building text-generation-inference...")
    build_tgi(venv_python, tgi_dir)
    
    print("TGI setup completed successfully!")
    return {
        "venv_path": venv_path,
        "tgi_path": os.path.join(tgi_dir, "text-generation-inference")
    }

if __name__ == "__main__":
    setup_tgi() 