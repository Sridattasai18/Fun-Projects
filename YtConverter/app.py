from flask import Flask, render_template, request, send_file, g
from pytubefix import YouTube
import os
import re
from urllib.parse import quote
from pathlib import Path

app = Flask(__name__)
DOWNLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
app.config['DOWNLOAD_FOLDER'] = DOWNLOAD_FOLDER

def is_valid_youtube_url(url):
    """Validate if the URL is a valid YouTube link"""
    youtube_regex = r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
    return re.match(youtube_regex, url) is not None


@app.after_request
def cleanup_files(response):
    """Delete temporary downloaded files after response is sent"""
    if hasattr(g, 'file_to_delete'):
        try:
            if os.path.exists(g.file_to_delete):
                os.remove(g.file_to_delete)
                print(f"Cleaned up: {g.file_to_delete}")
        except Exception as e:
            print(f"Warning: Could not delete {g.file_to_delete}: {e}")
    return response

# Home Page
@app.route("/")
def landing():
    return render_template("main.html")

@app.route("/index")
def converter():
    return render_template("index.html")


# When user clicks Convert
@app.route("/youtube/api", methods=["POST"])
def convert():
    link = request.form["link_input"].strip()
    file_type = request.form["file_type"]

    try:
        # Validate YouTube URL
        if not is_valid_youtube_url(link):
            return render_template("error.html",
                                 error_message="Please provide a valid YouTube URL")
        
        yt = YouTube(link)

        # Force data fetch
        yt.check_availability()

        title = yt.title
        author = yt.author
        thumbnail = yt.thumbnail_url
        length = yt.length

        return render_template("result.html",
                               title=title,
                               author=author,
                               thumbnail_url=thumbnail,
                               length=length,
                               link_input=link,
                               ftype=file_type)

    except Exception as e:
        print("ERROR:", e)  
        return render_template("error.html",
                               error_message=str(e))


# Download MP4
@app.route("/download")
def download_video():
    link = request.args.get("link")
    try:
        yt = YouTube(link)
        stream = yt.streams.get_highest_resolution()
        if not stream:
            return render_template("error.html",
                                 error_message="No video stream found for this URL")
        
        output_path = stream.download(DOWNLOAD_FOLDER)
        
        # output_path can be either the file path or directory path
        output_path_obj = Path(output_path)
        
        # If it's a file, use it directly
        if output_path_obj.is_file():
            file_path = output_path_obj
        else:
            # Search for media files recursively
            media_files = list(output_path_obj.rglob('*'))
            media_files = [f for f in media_files if f.is_file() and f.suffix.lower() in ['.mp4', '.webm', '.mkv']]
            
            if not media_files:
                print(f"DEBUG: Contents of {output_path}: {list(output_path_obj.rglob('*'))}")
                return render_template("error.html",
                                     error_message="Failed to locate video file. Please try another URL.")
            
            file_path = media_files[0]
        
        # Mark file for cleanup after download
        g.file_to_delete = str(file_path)
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        print(f"Download error: {e}")
        return render_template("error.html",
                             error_message=f"Download failed: {str(e)}")


# Download MP3
@app.route("/downloadmp3")
def download_mp3():
    link = request.args.get("link")
    try:
        yt = YouTube(link)
        stream = yt.streams.filter(only_audio=True).first()
        if not stream:
            return render_template("error.html",
                                 error_message="No audio stream found for this video")
        
        output_path = stream.download(DOWNLOAD_FOLDER)
        
        # output_path can be either the file path or directory path
        output_path_obj = Path(output_path)
        
        # If it's a file, use it directly
        if output_path_obj.is_file():
            file_path = output_path_obj
        else:
            # Search for audio files recursively
            audio_files = list(output_path_obj.rglob('*'))
            audio_files = [f for f in audio_files if f.is_file() and f.suffix.lower() in ['.webm', '.m4a', '.mp3', '.wav']]
            
            if not audio_files:
                print(f"DEBUG: Contents of {output_path}: {list(output_path_obj.rglob('*'))}")
                return render_template("error.html",
                                     error_message="Failed to locate audio file. Please try another URL.")
            
            file_path = audio_files[0]
        
        # Mark file for cleanup after download
        g.file_to_delete = str(file_path)
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        print(f"Download error: {e}")
        return render_template("error.html",
                             error_message=f"Download failed: {str(e)}")


if __name__ == "__main__":
    app.run(debug=True)
