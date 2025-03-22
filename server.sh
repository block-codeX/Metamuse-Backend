current_datetime=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
filename="server_${current_datetime}.tar.gz"
cd "$HOME/Desktop/projects/Metamuse-Backend"
rm -rf server*.gz
tar --exclude-from=.tarignore  -czvf "$filename" . || echo "tar command failed"
scp $filename metamuse:~/Metamuse-Backend/"$filename"
# scp requirements.txt metamuse:~/Playzone/requirements.txt
ssh metamuse << EOF
  # Unzip the contents to a folder called "server" in ~/
  echo "Unzipping to server folder"
    tar -xzvf ~/Metamuse-Backend/"$filename" -C ~/Metamuse-Backend --strip-components=1
    cd ~/Metamuse-Backend
    echo "linking service file to systemd"
    SERVICE_NAME="metamuse.service"
    SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
    SOURCE_PATH="~/Metamuse-Backend/metamuse.service"
    if [ -f "$SERVICE_PATH" ]; then
        echo "Removing existing service file..."
        sudo rm -f "$SERVICE_PATH"
    fi
    # Move the new service file
    if [ -f "$SOURCE_PATH" ]; then
        echo "Moving new service file to systemd directory..."
        sudo mv "$SOURCE_PATH" "$SERVICE_PATH"
    else
        echo "Service file not found in $SOURCE_PATH. Exiting."
        exit 1
    fi

    # Reload systemd, enable, and restart the service
    echo "Reloading systemd..."
    sudo systemctl daemon-reload

    echo "Enabling service..."
    sudo sr enable "$SERVICE_NAME"

    echo "Service complete!"

    echo "Installing npm requirements"
    npm install
    echo "Building the project"
    npm run build


    echo "Restarting service..."
    sudo service metamuse restart

  echo "Remote operations completed successfully"
EOF
