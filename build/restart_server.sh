#!/bin/bash
systemctl restart exocortex.service
sleep 2
systemctl status exocortex.service
journalctl -u exocortex.service --no-pager -n 20
