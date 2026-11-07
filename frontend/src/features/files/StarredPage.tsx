import type { FilesPageProps } from '@/types';
import { FilesPage } from './FilesPage';
export function StarredPage(props: FilesPageProps) {
  const starred = props.itemPreferences?.filter((item) => item.starred) ?? [];
  return <FilesPage {...props} emptyLabel={props.copy.emptyStarred} files={starred.flatMap((item) => item.file ? [item.file] : [])} folders={starred.flatMap((item) => item.folder ? [item.folder] : [])} currentFolder={null} currentFolderId={null} breadcrumbs={[]} title={props.copy.starredItems} />;
}
