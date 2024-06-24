from typing import Any, List, Optional

from azure.search.documents.aio import SearchClient
from azure.search.documents.models import VectorQuery
from openai import AsyncOpenAI
from approaches.approach import Approach, Document
from core.authentication import AuthenticationHelper

class SearchApproach(Approach):
    """
    An approach that focuses on retrieving relevant documents from Azure AI Search
    based on the user's query, without generating an AI-powered answer.
    """

    def __init__(
        self,
        search_client: SearchClient,
        openai_client: AsyncOpenAI,
        auth_helper: AuthenticationHelper,
        chatgpt_model: str,
        chatgpt_deployment: Optional[str],
        embedding_model: str,
        embedding_deployment: Optional[str],
        embedding_dimensions: int,
        sourcepage_field: str,
        content_field: str,
        query_language: str,
        query_speller: str,
    ):
        super().__init__(
            search_client,
            openai_client,
            auth_helper,
            query_language,
            query_speller,
            embedding_deployment,
            embedding_model,
            embedding_dimensions,
            None,  # openai_host
            None,  # vision_endpoint
            None,  # vision_token_provider
        )
        self.sourcepage_field = sourcepage_field
        self.content_field = content_field

    async def run(
        self,
        messages: List[dict[str, str]],
        session_state: Any = None,
        context: dict[str, Any] = {},
    ) -> dict[str, Any]:
        query = messages[-1]["content"]
        if not isinstance(query, str):
            raise ValueError("The most recent message content must be a string.")

        overrides = context.get("overrides", {})
        auth_claims = context.get("auth_claims", {})
        
        return await self.execute_search(query, overrides, auth_claims)

    async def execute_search(
        self,
        query: str,
        overrides: dict[str, Any],
        auth_claims: dict[str, Any],
    ) -> List[dict[str, Any]]:
        use_text_search = overrides.get("retrieval_mode") in ["text", "hybrid", None]
        use_vector_search = overrides.get("retrieval_mode") in ["vectors", "hybrid", None]
        use_semantic_ranker = overrides.get("semantic_ranker", False)
        use_semantic_captions = overrides.get("semantic_captions", False)
        top = overrides.get("top", 3)
        minimum_search_score = overrides.get("minimum_search_score", 0.0)
        minimum_reranker_score = overrides.get("minimum_reranker_score", 0.0)
        filter = self.build_filter(overrides, auth_claims)

        vectors: List[VectorQuery] = []
        if use_vector_search:
            vectors.append(await self.compute_text_embedding(query))

        results = await super().search(
            top,
            query,
            filter,
            vectors,
            use_text_search,
            use_vector_search,
            use_semantic_ranker,
            use_semantic_captions,
            minimum_search_score,
            minimum_reranker_score,
        )

        return [
            {
                "title": doc.sourcepage or "",
                "content": doc.content or "",
                "similarity": doc.score or 0.0,
            }
            for doc in results
        ]