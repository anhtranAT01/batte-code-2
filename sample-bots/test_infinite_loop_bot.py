#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 TEST BOT GÂY LỖI VÒNG LẶP VÔ HẠN (INFINITE LOOP TEST BOT)
 File: sample-bots/test_infinite_loop_bot.py
 Mục đích:
   - Cố tình chạy vòng lặp vô hạn (while True) không dừng
   - Dùng để kiểm thử hệ thống bảo vệ máy chấm (Distributed Judge Worker Timeout Guard)
   - Worker phải tự động phát hiện, ngắt tiến trình (kill process) sau 1.0 giây,
     và đánh dấu has_infinite_loop_error = true.
=============================================================================
"""

import sys
import time

def main():
    # 1. Đọc dữ liệu từ hệ thống bình thường
    try:
        raw_data = sys.stdin.read()
    except Exception:
        pass

    # 2. Cố tình rơi vào vòng lặp vô tận (Infinite Loop)
    counter = 0
    while True:
        counter += 1
        time.sleep(0.05)

if __name__ == "__main__":
    main()
