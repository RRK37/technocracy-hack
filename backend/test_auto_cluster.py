#!/usr/bin/env python3
"""
Test auto-detection of cluster numbers
"""

import requests
import json

BASE_URL = "http://localhost:5037"

def test_auto_clustering():
    """Test automatic cluster detection"""
    
    print("=" * 70)
    print("Testing Auto-Detection of Optimal Cluster Numbers")
    print("=" * 70)
    
    # Test with different questions that should have different cluster patterns
    questions = [
        "What is your favorite color?",  # Should have many clusters (diverse)
        "Should we help others?",         # Should have few clusters (consensus)
        "What makes life meaningful?",    # Moderate clusters (philosophical)
    ]
    
    for question in questions:
        print(f"\n\n📊 Question: '{question}'")
        print("-" * 70)
        
        # Send request with auto-detection (num_clusters=null)
        response = requests.post(
            f"{BASE_URL}/api/question",
            json={"question": question, "num_clusters": None}
        )
        
        if response.status_code == 200:
            data = response.json()
            num_clusters = data.get('num_clusters_used', 'unknown')
            
            print(f"✓ Auto-detected {num_clusters} clusters")
            print(f"  Average passion: {data['average_passion']:.2f}")
            print(f"\n  Clusters:")
            
            for cluster in data['clusters']:
                print(f"    • {cluster['representative_answer']:<40} "
                      f"({cluster['count']:2} chars, passion: {cluster['avg_passion']:.2f})")
            
            if data['outliers']['count'] > 0:
                print(f"\n  🌟 Outliers: {data['outliers']['count']} characters")
                print(f"     {', '.join(data['outliers']['answers'][:3])}")
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
    
    print("\n" + "=" * 70)
    print("✅ Auto-detection test complete!")
    print("=" * 70)

def test_manual_vs_auto():
    """Compare manual cluster specification vs auto-detection"""
    
    print("\n\n" + "=" * 70)
    print("Comparing Manual (5 clusters) vs Auto-Detection")
    print("=" * 70)
    
    question = "What should I do this weekend?"
    
    # Manual: 5 clusters
    print(f"\n📍 Manual (5 clusters):")
    response_manual = requests.post(
        f"{BASE_URL}/api/question",
        json={"question": question, "num_clusters": 5}
    )
    
    if response_manual.status_code == 200:
        data = response_manual.json()
        print(f"  Used {data['num_clusters_used']} clusters")
        for cluster in data['clusters']:
            print(f"    • {cluster['representative_answer']} ({cluster['count']} chars)")
    
    # Wait a moment for system to process
    import time
    time.sleep(2)
    
    # Auto-detection
    print(f"\n🤖 Auto-detection:")
    response_auto = requests.post(
        f"{BASE_URL}/api/question",
        json={"question": question, "num_clusters": None}
    )
    
    if response_auto.status_code == 200:
        data = response_auto.json()
        print(f"  Detected {data['num_clusters_used']} clusters as optimal")
        for cluster in data['clusters']:
            print(f"    • {cluster['representative_answer']} ({cluster['count']} chars)")
    
    print("\n" + "=" * 70)

if __name__ == '__main__':
    try:
        # Check if server is running
        health = requests.get(f"{BASE_URL}/api/health", timeout=2)
        if health.status_code != 200:
            print("❌ Server not responding properly")
            exit(1)
        
        test_auto_clustering()
        # test_manual_vs_auto()  # Uncomment to compare manual vs auto
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to server at", BASE_URL)
        print("   Make sure the server is running:")
        print("   python generateResponses.py")
        exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        exit(0)
