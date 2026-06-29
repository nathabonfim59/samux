#!/bin/sh
# samux battery segment for the status bar.
# Prints a percentage like "75%" (or "100%" if no battery is found).
# Used by: set -g status-right "#(~/.config/samux/scripts/battery.sh)"
#
# Install: copy this file to ~/.config/samux/scripts/battery.sh and make it
# executable:  chmod +x ~/.config/samux/scripts/battery.sh

# 1) Try the sysfs interface (most Linux laptops).
for bat in /sys/class/power_supply/BAT0 /sys/class/power_supply/BAT1; do
    if [ -r "$bat/capacity" ]; then
        printf '%s%%' "$(cat "$bat/capacity" 2>/dev/null)"
        exit 0
    fi
done

# 2) Try upower.
if command -v upower >/dev/null 2>&1; then
    bat_dev="$(upower -e 2>/dev/null | grep -i 'BAT' | head -n 1)"
    if [ -n "$bat_dev" ]; then
        pct="$(upower -i "$bat_dev" 2>/dev/null | awk -F'[: ]+' '/percentage/ {gsub(/%/,""); print $4; exit}')"
        if [ -n "$pct" ]; then
            printf '%s%%' "$pct"
            exit 0
        fi
    fi
fi

# 3) Try acpi.
if command -v acpi >/dev/null 2>&1; then
    pct="$(acpi -b 2>/dev/null | grep -oE '[0-9]+%' | head -n 1)"
    if [ -n "$pct" ]; then
        printf '%s' "$pct"
        exit 0
    fi
fi

# 4) Give up gracefully.
printf '100%%'
