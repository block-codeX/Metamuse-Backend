#!/bin/bash

# filepath: c:\Users\Phyro\Desktop\projects\Metamuse-Backend\run.sh

while true; do
  echo "Starting swc-node..."
  swc-node src/main.ts
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "swc-node crashed with exit code $EXIT_CODE. Restarting..."
    sleep 1
  else
    echo "swc-node exited normally. Exiting script."
    break
  fi
done