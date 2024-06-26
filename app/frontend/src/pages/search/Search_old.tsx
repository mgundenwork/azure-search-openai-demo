import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dropdown, TextField, PrimaryButton, Spinner, IconButton, Checkbox, Toggle } from '@fluentui/react';
import { searchApi, SearchResult, SearchRequest } from '../../api';
import { useLogin, getToken } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { getCitationFilePath } from "../../api";
//import { AnalysisPanelTabs } from "../../components/AnalysisPanel";
import styles from './Search.module.css';

enum SearchType {
    Keyword = 'keyword',
    Vector = 'vector',
    Hybrid = 'hybrid'
}

interface GroupedResult {
    sourcepage: string;
    matches: SearchResult[];
}


export const Search: React.FC = () => {
    const [searchType, setSearchType] = useState<SearchType>(SearchType.Keyword);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(false);
    const [maxResults, setMaxResults] = useState<number>(5);
    const [minSimilarity, setMinSimilarity] = useState<number>(0.7);
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    /*const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);*/
    const [activeCitation, setActiveCitation] = useState<string | undefined>(undefined);
    /*const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);*/
    const [isSearchBoxVisible, setIsSearchBoxVisible] = useState<boolean>(true);
    const [searchInPdf, setSearchInPdf] = useState<string>('');
    const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

    const pdfViewerRef = useRef<HTMLIFrameElement>(null);
    const client = useLogin ? useMsal().instance : undefined;

   /* useEffect(() => {
        const checkAuth = async () => {
            if (useLogin && client) {
                const loggedIn = isLoggedIn(client);
                console.log("Is user logged in?", loggedIn);
                setIsAuthenticated(loggedIn);
            } else {
                console.log("Login not used or client not available");
                setIsAuthenticated(true); // Assume authenticated if login is not used
            }
        };
        checkAuth();
    }, [client]);*/

    /*const searchTypeOptions: IDropdownOption[] = [
        { key: SearchType.Keyword, text: 'Keyword Search' },
        { key: SearchType.Vector, text: 'Vector Search' },
        { key: SearchType.Hybrid, text: 'Hybrid Search' }
    ];*/

    const handleSearch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = useLogin && client ? await getToken(client) : undefined;

            const searchRequest: SearchRequest = {
                query,
                searchType: searchType.toLowerCase() as 'keyword' | 'vector' | 'hybrid',
                useSemanticRanker,
                maxResults: Number(maxResults),
                minSimilarity: searchType !== SearchType.Keyword ? minSimilarity : undefined
            };

            console.log("Search request:", JSON.stringify(searchRequest, null, 2));

            const searchResults = await searchApi(searchRequest, token);
            
            console.log("Search results:", searchResults);
            console.log("Number of results returned:", searchResults.length);
            
            if (Array.isArray(searchResults)) {
                setResults(searchResults);
            } else {
                console.error("Unexpected search results format:", searchResults);
                setError('Received unexpected search results format.');
            }
            setIsSearchBoxVisible(false);  // Hide search box after search
        } catch (error) {
            console.error('Search failed:', error);
            setError('An error occurred during the search. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    /*const getCitation = (sourcepage: string): string => {
        console.log("Getting citation for:", sourcepage);  // Log the input
        const [path, ext] = sourcepage.split('.');
        if (ext && ext.toLowerCase() === 'png') {
            const pageIdx = path.lastIndexOf('-');
            if (pageIdx !== -1) {
                const pageNumber = parseInt(path.slice(pageIdx + 1), 10);
                const result = `${path.slice(0, pageIdx)}.pdf#page=${pageNumber}`;
                console.log("Resulting citation:", result);  // Log the result
                return result;
            }
        }
        console.log("Returning original sourcepage");  // Log when returning original
        return sourcepage;
    };*/

    /*const extractPageNumber = (sourcepage: string): string => {
        console.log("Extracting page number from:", sourcepage);  // Log the input
        // Try to extract page number from filename (e.g., "document-name-123.pdf")
        const fileNameMatch = sourcepage.match(/-(\d+)\.pdf$/);
        if (fileNameMatch) {
            console.log("Page number from filename:", fileNameMatch[1]);  // Log when found in filename
            return fileNameMatch[1];
        }

        // If not found in filename, try to extract from citation format
        const citation = getCitation(sourcepage);
        const pageMatch = citation.match(/#page=(\d+)$/);
        if (pageMatch) {
            console.log("Page number from citation:", pageMatch[1]);  // Log when found in citation
            return pageMatch[1];
        }

        console.log("Page number not found, returning N/A");  // Log when not found
        return 'N/A';
    };*/

   /* const handleCitationClick = (sourcepage: string) => {
        console.log("Citation click for:", sourcepage);  // Log the clicked sourcepage
        const citation = getCitation(sourcepage);
        const fullCitationPath = `/content/${citation}`;
        console.log("Full citation path:", fullCitationPath);  // Log the full path
        setActiveCitation(activeCitation === fullCitationPath ? undefined : fullCitationPath);
    };*/
    /*const handleCitationClick = (sourcepage: string, content: string) => {
        // Take the first 10 words of the content to search in the PDF
        const searchText = content.split(' ').slice(0, 10).join(' ');
        // Encode the search text for use in a URL
        const encodedSearchText = encodeURIComponent(searchText);
        // Construct the PDF URL with the search parameter
        const pdfUrl = `/content/${sourcepage}#search="${encodedSearchText}"`;
        setActiveCitation(pdfUrl);
    };*/
    const handleDocumentClick = (sourcepage: string) => {
        const pdfUrl = `/content/${sourcepage}`;
        setActiveCitation(pdfUrl);
    };

    useEffect(() => {
        if (activeCitation && searchInPdf && pdfViewerRef.current) {
            // Give the PDF viewer some time to load before sending the search command
            const timer = setTimeout(() => {
                pdfViewerRef.current?.contentWindow?.postMessage({
                    type: 'search',
                    query: searchInPdf,
                    caseSensitive: false,
                    highlightAll: true,
                    findPrevious: false
                }, '*');
            }, 10000);

            return () => clearTimeout(timer);
        }
    }, [activeCitation, searchInPdf]);

    const toggleDocExpansion = (sourcepage: string) => {
        setExpandedDocs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sourcepage)) {
                newSet.delete(sourcepage);
            } else {
                newSet.add(sourcepage);
            }
            return newSet;
        });
    };

    const groupedResults = useMemo(() => {
        const groups: { [key: string]: GroupedResult } = {};
        results.forEach(result => {
            if (!groups[result.sourcepage]) {
                groups[result.sourcepage] = { sourcepage: result.sourcepage, matches: [] };
            }
            groups[result.sourcepage].matches.push(result);
        });
        return Object.values(groups).sort((a, b) => b.matches.length - a.matches.length);
    }, [results]);

    /*const renderSearchResults = () => {
        return results.map((result, index) => (
            <div key={index} className={styles.searchResult}>
                <h3>{index + 1}. {result.title}</h3>
                {result.sourcepage && (
                    <p>Page: {extractPageNumber(result.sourcepage)} (Source: {result.sourcepage})</p>
                )}
                <p>Similarity: {result.similarity.toFixed(2)}</p>
                <PrimaryButton onClick={() => handleCitationClick(result.sourcepage)}>View Document</PrimaryButton>
                <div className={styles.contentToggle}>
                    <Checkbox
                        label="Show Content"
                        onChange={(_, checked) => {
                            const contentElement = document.getElementById(`content-${index}`);
                            if (contentElement) {
                                contentElement.style.display = checked ? 'block' : 'none';
                            }
                        }}
                    />
                </div>
                <div id={`content-${index}`} style={{display: 'none'}}>
                    <p>{result.content}</p>
                </div>
            </div>
        ));
    };*/

    const renderSearchResults = () => {
        return groupedResults.map((group, index) => (
            <div key={index} className={styles.searchResult}>
                <h3>{index + 1}. {group.sourcepage} ({group.matches.length} matches)</h3>
                <PrimaryButton onClick={() => handleDocumentClick(group.sourcepage)}>
                    View Document
                </PrimaryButton>
                <Toggle
                    label={`Show ${group.matches.length} citations`}
                    checked={expandedDocs.has(group.sourcepage)}
                    onChange={() => toggleDocExpansion(group.sourcepage)}
                />
                {expandedDocs.has(group.sourcepage) && (
                    <div className={styles.citations}>
                        {group.matches.map((result, citationIndex) => (
                            <div key={citationIndex} className={styles.citation}>
                                <p>Similarity: {result.similarity.toFixed(2)}</p>
                                <div className={styles.contentToggle}>
                                    <Checkbox
                                        label="Show Content"
                                        onChange={(_, checked) => {
                                            const contentElement = document.getElementById(`content-${index}-${citationIndex}`);
                                            if (contentElement) {
                                                contentElement.style.display = checked ? 'block' : 'none';
                                            }
                                        }}
                                    />
                                </div>
                                <div id={`content-${index}-${citationIndex}`} style={{display: 'none'}}>
                                    <p>{result.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className={styles.searchContainer}>
            {isSearchBoxVisible ? (
                <div className={styles.searchTopSection}>
                    <h1 className={styles.searchTitle}>Search</h1>
                    <div className={styles.searchControls}>
                        <TextField 
                            label="Search Query" 
                            value={query} 
                            onChange={(_, newValue) => setQuery(newValue || '')} 
                        />
                        <Dropdown
                            label="Search Type"
                            selectedKey={searchType}
                            options={[
                                { key: SearchType.Keyword, text: 'Keyword' },
                                { key: SearchType.Vector, text: 'Vector' },
                                { key: SearchType.Hybrid, text: 'Hybrid' },
                            ]}
                            onChange={(_, option) => option && setSearchType(option.key as SearchType)}
                        />
                        <Checkbox
                            label="Use Semantic Ranker"
                            checked={useSemanticRanker}
                            onChange={(_, checked) => setUseSemanticRanker(!!checked)}
                        />
                        <TextField
                            label="Max Results"
                            type="number"
                            value={maxResults.toString()}
                            onChange={(_, newValue) => setMaxResults(Number(newValue) || 5)}
                        />
                        {searchType !== SearchType.Keyword && (
                            <TextField
                                label="Minimum Similarity"
                                type="number"
                                value={minSimilarity.toString()}
                                onChange={(_, newValue) => setMinSimilarity(Number(newValue) || 0.7)}
                                step={0.1}
                                min={0}
                                max={1}
                            />
                        )}
                        <PrimaryButton text="Search" onClick={handleSearch} disabled={isLoading || !query.trim()} />
                    </div>
                </div>
            ) : (
                <div className={styles.searchTopSection}>
                    <IconButton
                        iconProps={{ iconName: 'Search' }}
                        onClick={() => setIsSearchBoxVisible(true)}
                        className={styles.showSearchButton}
                    />
                </div>
            )}
            <div className={`${styles.searchBottomSection} ${activeCitation ? styles.withCitation : ''}`}>
                {isLoading && <Spinner label="Searching..." />}
                {error && <div className={styles.errorMessage}>{error}</div>}
                <div className={styles.searchResults}>
                    {renderSearchResults()}
                </div>
                {activeCitation && (
                    <div className={styles.pdfViewerContainer}>
                        <iframe 
                            src={activeCitation} 
                            className={styles.pdfViewer}
                            title="PDF Viewer"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
