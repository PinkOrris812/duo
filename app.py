# app.py
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_cors import CORS
import pymysql
import os
from datetime import datetime
import uuid

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)  # Enable CORS for all routes
app.secret_key = os.urandom(24)  # For session management

# Database connection configuration
DB_CONFIG = {
    'unix_socket': '/tmp/mysql.sock', 
    'user': 'root',
    'password': '881122',  # Replace with your actual password
    'db': 'duo',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

# Helper function to get database connection
def get_db_connection():
    return pymysql.connect(**DB_CONFIG)

# Route to serve the main page
@app.route('/')
def index():
    # In a real app, you'd serve your HTML from here
    # For now, we'll just redirect to your static HTML file
    return redirect('/static/index.html')

@app.route('/api/test-db')
def test_db_connection():
    try:
        # Try to connect to the database
        connection = get_db_connection()
        with connection.cursor() as cursor:
            # Try a simple query
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
        connection.close()
        return jsonify({"status": "success", "message": "Database connection successful", "result": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# API endpoint to submit a phrase
@app.route('/api/phrases', methods=['POST'])
def submit_phrase():
    try:
        data = request.json
        
        # Get form data from request
        phrase = data.get('phrase')
        language_code = data.get('languageCode')
        category = data.get('category')
        
        # Validate data
        if not phrase or not language_code or not category:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Get user from session or create a temporary one
        user_id = session.get('user_id')
        if not user_id:
            # In a real app, you'd handle user registration/login properly
            # For now, we'll create a temporary user for the demo
            username = f"temp_user_{uuid.uuid4().hex[:8]}"
            
            connection = get_db_connection()
            try:
                with connection.cursor() as cursor:
                    # Insert new user
                    cursor.execute(
                        "INSERT INTO Users (username, duolingo_user) VALUES (%s, %s)",
                        (username, False)
                    )
                    user_id = cursor.lastrowid
                    session['user_id'] = user_id  # Store in session
                connection.commit()
            finally:
                connection.close()
        
        # Get category ID
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT category_id FROM Categories WHERE name = %s",
                    (category,)
                )
                category_result = cursor.fetchone()
                if not category_result:
                    return jsonify({'error': 'Invalid category'}), 400
                
                category_id = category_result['category_id']
                
                # Insert phrase
                cursor.execute(
                    "INSERT INTO Phrases (user_id, content, language_code, category_id) VALUES (%s, %s, %s, %s)",
                    (user_id, phrase, language_code, category_id)
                )
                phrase_id = cursor.lastrowid
                
            connection.commit()
            print("Transction committed successfully")
            
            return jsonify({
                'success': True,
                'message': 'Phrase submitted successfully',
                'phrase_id': phrase_id
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            connection.close()
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API endpoint to get phrases
@app.route('/api/phrases', methods=['GET'])
def get_phrases():
    try:
        # Get query parameters
        language_code = request.args.get('language')
        category_id = request.args.get('category')
        limit = int(request.args.get('limit', 50))  # Default to 50 phrases
        
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # Build query based on filters
                query = """
                SELECT p.phrase_id, p.content, p.language_code, l.language_name, 
                       c.name AS category_name, u.username AS submitted_by,
                       p.submitted_at, p.upvotes, p.downvotes, p.score
                FROM Phrases p
                JOIN Languages l ON p.language_code = l.language_code
                JOIN Categories c ON p.category_id = c.category_id
                JOIN Users u ON p.user_id = u.user_id
                WHERE 1=1
                """
                params = []
                
                if language_code:
                    query += " AND p.language_code = %s"
                    params.append(language_code)
                
                if category_id:
                    query += " AND p.category_id = %s"
                    params.append(category_id)
                
                query += " ORDER BY p.score DESC LIMIT %s"
                params.append(limit)
                
                cursor.execute(query, params)
                phrases = cursor.fetchall()
                
                # Convert datetime objects to strings for JSON serialization
                for phrase in phrases:
                    if isinstance(phrase['submitted_at'], datetime):
                        phrase['submitted_at'] = phrase['submitted_at'].isoformat()
                
                return jsonify(phrases)
                
        finally:
            connection.close()
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API endpoint to vote on a phrase
@app.route('/api/votes', methods=['POST'])
def submit_vote():
    try:
        data = request.json
        
        # Get data from request
        phrase_id = data.get('phrase_id')
        vote_value = data.get('vote_value')  # 1 for upvote, -1 for downvote, 0 for no vote
        
        # Validate data
        if phrase_id is None or vote_value is None:
            return jsonify({'error': 'Missing required fields'}), 400
            
        if vote_value not in [-1, 0, 1]:
            return jsonify({'error': 'Invalid vote value'}), 400
        
        # Get user from session
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # Check if user has already voted on this phrase
                cursor.execute(
                    "SELECT vote_id, vote_value FROM Votes WHERE user_id = %s AND phrase_id = %s",
                    (user_id, phrase_id)
                )
                existing_vote = cursor.fetchone()
                
                if existing_vote:
                    # Update existing vote
                    cursor.execute(
                        "UPDATE Votes SET vote_value = %s WHERE vote_id = %s",
                        (vote_value, existing_vote['vote_id'])
                    )
                else:
                    # Insert new vote
                    cursor.execute(
                        "INSERT INTO Votes (user_id, phrase_id, vote_value) VALUES (%s, %s, %s)",
                        (user_id, phrase_id, vote_value)
                    )
                
            connection.commit()
            
            return jsonify({
                'success': True,
                'message': 'Vote recorded successfully'
            })
            
        finally:
            connection.close()
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)