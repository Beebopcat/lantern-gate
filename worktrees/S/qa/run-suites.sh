#!/bin/sh
# Runs the browser suites one after another (detached use: setsid nohup ./run-suites.sh &)
cd "$(dirname "$0")"
for t in flow.test.mjs battle.browser.test.mjs classes.browser.test.mjs music.browser.test.mjs music-title.test.mjs; do
  echo "=== $t $(date +%T)" >> suites.log
  node $t > "log-$t.txt" 2>&1
  tail -2 "log-$t.txt" >> suites.log
done
echo "=== done $(date +%T)" >> suites.log
