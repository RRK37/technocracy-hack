#!/usr/bin/env python3
"""
Test script for the generalized question system with clustering
Run this to verify the clustering implementation works correctly
"""

import json
import os
from pathlib import Path

# Add parent directory to path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from generateResponses import (
    get_embeddings,
    cosine_similarity,
    cluster_answers
)

def test_embeddings():
    """Test OpenAI embeddings API"""
    print("Testing embeddings API...")
    texts = ["Go hiking", "Take a hike", "Stay home and read"]
    embeddings = get_embeddings(texts)
    
    assert len(embeddings) == 3, "Should get 3 embeddings"
    assert len(embeddings[0]) > 0, "Embeddings should not be empty"
    
    # Test similarity
    sim_hiking = cosine_similarity(embeddings[0], embeddings[1])
    sim_different = cosine_similarity(embeddings[0], embeddings[2])
    
    print(f"  ✓ Similarity (hiking vs hiking): {sim_hiking:.3f}")
    print(f"  ✓ Similarity (hiking vs reading): {sim_different:.3f}")
    assert sim_hiking > sim_different, "Similar phrases should have higher similarity"
    print("  ✓ Embeddings test passed!\n")

def test_clustering():
    """Test clustering algorithm"""
    print("Testing clustering algorithm...")
    
    # Mock character data
    mock_characters = [
        {'id': 1, 'short_answer': 'Go hiking', 'passion': 0.8},
        {'id': 2, 'short_answer': 'Take a nature walk', 'passion': 0.7},
        {'id': 3, 'short_answer': 'Stay home and read', 'passion': 0.6},
        {'id': 4, 'short_answer': 'Read a good book', 'passion': 0.5},
        {'id': 5, 'short_answer': 'Go for a hike', 'passion': 0.9},
        {'id': 6, 'short_answer': 'Work on personal projects', 'passion': 0.4},
        {'id': 7, 'short_answer': 'Explore the outdoors', 'passion': 0.75},
    ]
    
    # Cluster with 2 themes
    results = cluster_answers(mock_characters, num_clusters=2, similarity_threshold=0.5)
    
    print(f"  Found {len(results['clusters'])} clusters")
    for cluster in results['clusters']:
        print(f"    Cluster {cluster['id']}: '{cluster['representative_answer']}' "
              f"({cluster['count']} members, passion: {cluster['avg_passion']:.2f})")
        print(f"      Character IDs: {cluster['character_ids']}")
    
    if results['outliers']['count'] > 0:
        print(f"  Outliers: {results['outliers']['count']} characters")
        print(f"    Answers: {results['outliers']['answers']}")
    
    assert len(results['clusters']) > 0, "Should find at least 1 cluster"
    print("  ✓ Clustering test passed!\n")

def main():
    print("=" * 60)
    print("Testing Generalized Question System with Clustering")
    print("=" * 60 + "\n")
    
    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not set in environment")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        sys.exit(1)
    
    try:
        test_embeddings()
        test_clustering()
        
        print("=" * 60)
        print("✅ All tests passed!")
        print("=" * 60)
        print("\nThe system is ready to use. Start the server with:")
        print("  python generateResponses.py")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
