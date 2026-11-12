"""Local static server with no caching (so edits show up on reload). Run: python serve.py"""
import http.server, socketserver, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(os.environ.get('PORT') or (sys.argv[1] if len(sys.argv) > 1 else 8766))
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), H) as s:
    print(f'Serving http://localhost:{port}/')
    s.serve_forever()
