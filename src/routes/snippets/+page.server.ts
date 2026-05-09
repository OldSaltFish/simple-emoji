import { codeSnippetsApi } from '$lib/api/codeSnippets';
import { snippetTagsApi } from '$lib/api/snippetTags';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const search = url.searchParams.get('search') || undefined;
  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';
  const tagsParam = url.searchParams.get('tags') || undefined;
  const framework = url.searchParams.get('framework') || undefined;

  const [tagsData, codeSnippetsData] = await Promise.all([
    snippetTagsApi.getTags(),
    codeSnippetsApi.getCodeSnippets({
      search,
      tags: tagsParam,
      framework,
      page,
      page_size: 20,
      sortBy,
      sortOrder
    })
  ]);

  const seen = new Set<string>();
  const tags = tagsData.filter((tag: { name: string }) => {
    if (seen.has(tag.name)) return false;
    seen.add(tag.name);
    return true;
  });

  return {
    tags,
    codeSnippets: codeSnippetsData?.code_snippets || [],
    total: codeSnippetsData?.total || 0,
    totalPages: codeSnippetsData?.total_pages || 1,
    currentPage: page,
    filters: { search, sortBy, sortOrder, tags: tagsParam?.split(','), framework }
  };
};