import json
import urllib.request
import unittest
from unittest.mock import patch
from banking_complaints_agent.server import fetch_cfpb


class TestFetchCFPB(unittest.TestCase):
    def test_fetch_cfpb(self):
        sample_data = {"hits": {"total": 1, "hits": [{"_source": {"company": "Test"}}]}}

        class DummyResponse:
            def __init__(self, data, status=200):
                self._data = data
                self.status = status

            def read(self):
                return json.dumps(self._data).encode()

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                pass

        def dummy_urlopen(url):
            return DummyResponse(sample_data)

        with patch.object(urllib.request, "urlopen", dummy_urlopen):
            result = fetch_cfpb({"searchTerm": "test", "size": 1})
            self.assertEqual(result, sample_data)


if __name__ == "__main__":
    unittest.main()
