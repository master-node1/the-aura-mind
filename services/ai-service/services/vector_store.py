"""
ChromaDB vector store wrapper for semantic memory.
"""
import logging
from typing import List, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "TheAuraLab_memories"


class VectorStoreService:
    def __init__(self):
        self._client: Optional[chromadb.HttpClient] = None
        self._collection = None

    @property
    def client(self) -> chromadb.HttpClient:
        if self._client is None:
            self._client = chromadb.HttpClient(
                host=settings.chroma_host,
                port=settings.chroma_port,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    async def add_memory(
        self,
        embedding_id: str,
        text: str,
        metadata: dict,
    ) -> bool:
        """Store a memory with its text (ChromaDB will embed it)."""
        try:
            self.collection.add(
                ids=[embedding_id],
                documents=[text],
                metadatas=[metadata],
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add memory to ChromaDB: {e}")
            return False

    async def search_memories(
        self,
        query: str,
        user_id: str,
        n_results: int = 5,
    ) -> List[dict]:
        """Semantic search for relevant memories."""
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                where={"user_id": user_id},
            )
            memories = []
            if results["ids"] and results["ids"][0]:
                for i, doc_id in enumerate(results["ids"][0]):
                    memories.append(
                        {
                            "id": doc_id,
                            "content": results["documents"][0][i],
                            "metadata": results["metadatas"][0][i],
                            "distance": results["distances"][0][i] if results.get("distances") else 0,
                        }
                    )
            return memories
        except Exception as e:
            logger.error(f"ChromaDB search error: {e}")
            return []

    async def delete_memory(self, embedding_id: str) -> bool:
        try:
            self.collection.delete(ids=[embedding_id])
            return True
        except Exception as e:
            logger.error(f"Failed to delete memory from ChromaDB: {e}")
            return False

    async def update_memory(self, embedding_id: str, text: str, metadata: dict) -> bool:
        try:
            self.collection.update(
                ids=[embedding_id],
                documents=[text],
                metadatas=[metadata],
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update memory in ChromaDB: {e}")
            return False


vector_store = VectorStoreService()
