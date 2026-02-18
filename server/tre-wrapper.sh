#!/bin/sh
# Wrapper for tre that uses the host's tmux socket
exec /root/tools/tre_orig -S /tmp/tmux-1001/default "$@"
