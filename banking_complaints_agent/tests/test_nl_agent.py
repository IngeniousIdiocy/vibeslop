import os
import unittest
from banking_complaints_agent.nl_agent import load_groq_api_key


class TestLoadGroqApiKey(unittest.TestCase):
    def test_load_from_file(self):
        with open('tmp_key.txt', 'w', encoding='utf-8') as f:
            f.write('abc123')
        try:
            key = load_groq_api_key('tmp_key.txt')
            self.assertEqual(key, 'abc123')
        finally:
            os.remove('tmp_key.txt')

    def test_missing_file(self):
        key = load_groq_api_key('nonexistent.txt')
        self.assertEqual(key, 'your_api_key_here')


if __name__ == '__main__':
    unittest.main()
